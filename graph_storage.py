"""Independent graph objects in private Vercel Blob; no shared writable index."""
import hashlib
import json
import re

from vercel.blob import BlobClient, BlobNotFoundError


class BlobGraphStore:
    @staticmethod
    def _id(gid):
        if not re.fullmatch(r"[a-f0-9]{12}", gid):
            raise ValueError("Invalid graph id")
        return gid

    def _read(self, path):
        with BlobClient() as client:
            try:
                result = client.get(path, access="private", use_cache=False, timeout=15)
            except BlobNotFoundError:
                return None
            return result.content if result else None

    def info(self, gid):
        data = self._read(f"metadata/{self._id(gid)}.json")
        return json.loads(data) if data is not None else None

    def html(self, gid):
        data = self._read(f"graphs/{self._id(gid)}.html")
        return data.decode("utf-8") if data is not None else None

    def index(self):
        paths = []
        with BlobClient() as client:
            cursor = None
            while True:
                page = client.list_objects(prefix="metadata/", cursor=cursor, limit=1000)
                paths.extend(item.pathname for item in page.blobs)
                if not page.has_more:
                    break
                cursor = page.cursor
        from concurrent.futures import ThreadPoolExecutor
        ids = [p.removeprefix("metadata/").removesuffix(".json") for p in paths]
        with ThreadPoolExecutor(max_workers=6) as pool:
            records = list(pool.map(self.info, ids))
        return {"graphs": {gid: info for gid, info in zip(ids, records) if info is not None}}

    def save(self, gid, html, info):
        gid = self._id(gid)
        payload = html.encode("utf-8")
        digest = hashlib.sha256(payload).hexdigest()
        metadata = dict(info, html_sha256=digest)
        existing = self.info(gid)
        if existing is not None:
            if existing.get("html_sha256") != digest:
                raise ValueError("Graph id already exists with different content")
            if self.html(gid) != html:
                raise ValueError("Stored graph content does not match its metadata")
            return
        # Retry an incomplete import safely. Publish metadata only after HTML exists.
        previous_html = self.html(gid)
        if previous_html is not None and previous_html != html:
            raise ValueError("Incomplete graph has different content")
        with BlobClient() as client:
            if previous_html is None:
                client.put(f"graphs/{gid}.html", payload, access="private", content_type="text/html; charset=utf-8")
            client.put(f"metadata/{gid}.json", json.dumps(metadata, ensure_ascii=False).encode("utf-8"),
                       access="private", content_type="application/json")

    def delete(self, gid):
        gid = self._id(gid)
        with BlobClient() as client:
            # Remove the archive entry first, so a partially deleted graph stays hidden.
            client.delete(f"metadata/{gid}.json")
            client.delete(f"graphs/{gid}.html")
