"""Exercise the gateway against the actual PC backend with isolated storage."""
import importlib.util
import os
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import URLError

from werkzeug.serving import make_server


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ROOT = Path(__file__).resolve().parent
gateway = load("gateway", ROOT / "gateway_server.py")
backend = load("pc_backend", ROOT.parent / "server.py")


class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.storage = tempfile.TemporaryDirectory()
        backend.GRAPHS_DIR = self.storage.name
        backend.INDEX_PATH = str(Path(self.storage.name) / "_index.json")
        backend.API_SECRET = "test-api-secret"
        direct = backend.app.test_client()
        response = direct.post("/api/graphs", json={
            "html": "<html><head></head><body>Graph</body></html>",
            "label": "Test graph", "nodes": 2, "edges": 1,
        }, headers={"X-GiftGraph-Secret": backend.API_SECRET})
        self.gid = response.json["id"]
        self.server = make_server("127.0.0.1", 0, backend.app)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.environment = patch.dict(os.environ, {
            "GIFTGRAPH_BACKEND_URL": f"http://127.0.0.1:{self.server.server_port}"
        })
        self.environment.start()
        self.client = gateway.app.test_client()

    def tearDown(self):
        self.server.shutdown()
        self.thread.join(timeout=2)
        self.server.server_close()
        self.environment.stop()
        self.storage.cleanup()

    def test_pages_and_assets_use_the_pc_backend(self):
        home = self.client.get("/")
        self.assertEqual(home.status_code, 200)
        self.assertIn(b"Test graph", home.data)
        graph = self.client.get(f"/view/{self.gid}")
        self.assertEqual(graph.status_code, 200)
        self.assertIn(b"giftgraph-miniapp.js", graph.data)
        self.assertEqual(self.client.get("/assets/giftgraph-miniapp.js").status_code, 200)
        self.assertEqual(self.client.get("/health").json["status"], "ok")
        self.assertEqual(self.client.get("/view/missing").status_code, 404)

    def test_deletion_preserves_backend_authorization(self):
        path = f"/api/graphs/{self.gid}"
        self.assertEqual(self.client.delete(path).status_code, 401)
        self.assertTrue(Path(self.storage.name, self.gid + ".html").exists())
        response = self.client.delete(path, headers={
            "X-GiftGraph-Delete-Token": backend._delete_token(self.gid)
        })
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Path(self.storage.name, self.gid + ".html").exists())
        self.assertEqual(self.client.post("/api/graphs", json={}).status_code, 405)

    def test_offline_site_and_api_report_unavailability(self):
        with patch.object(gateway, "urlopen", side_effect=URLError("offline")):
            response = self.client.get("/")
            self.assertEqual(response.status_code, 503)
            self.assertIn("Графы сейчас недоступны".encode(), response.data)
            self.assertEqual(response.headers["Cache-Control"], "no-store")
            self.assertEqual(self.client.get("/health").json, {"error": "backend unavailable"})

    def test_invalid_configuration_cannot_recurse(self):
        for url in ["", "http://example.com", "https://localhost", "https://example.com/path"]:
            with self.subTest(url=url), patch.dict(os.environ, {"GIFTGRAPH_BACKEND_URL": url}):
                self.assertEqual(self.client.get("/health").status_code, 503)


if __name__ == "__main__":
    unittest.main()
