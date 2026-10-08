"""Copy the local archive to Blob, preserving IDs; verify every byte on retry."""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from dotenv import load_dotenv
from graph_storage import BlobGraphStore


def main():
    root = Path(__file__).parent
    load_dotenv(root / "vercel/.env.production.local")
    index = json.loads((root / "graphs/_index.json").read_text(encoding="utf-8"))["graphs"]

    def copy(item):
        gid, info = item
        html = (root / "graphs" / f"{gid}.html").read_text(encoding="utf-8")
        store = BlobGraphStore()
        store.save(gid, html, info)
        remote = store.info(gid)
        assert all(remote.get(k) == v for k, v in info.items()), f"Metadata mismatch: {gid}"
        assert store.html(gid) == html, f"HTML mismatch: {gid}"
        print(f"Verified {gid}", flush=True)

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(copy, index.items()))
    print(f"Copied and verified {len(index)} graphs. Local archive preserved.")


if __name__ == "__main__":
    main()
