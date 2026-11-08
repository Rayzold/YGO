"""End-to-end test of sync_images.py against a local fake of Supabase Storage + image host."""
import json
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(__file__)
SCRIPT = os.path.join(HERE, "..", "sync_images.py")
KEY = "service-key"


def make_server(state):
    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _json(self, code, obj):
            body = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _auth_ok(self):
            return self.headers.get("Authorization") == f"Bearer {KEY}" and self.headers.get("apikey") == KEY

        def do_GET(self):
            if self.path.startswith("/img/"):
                cid = self.path.rsplit("/", 1)[1]
                if cid == "404.jpg":
                    return self._json(404, {})
                body = b"\xff\xd8fake-jpeg-" + cid.encode()
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.end_headers()
                return self.wfile.write(body)
            if self.path == "/storage/v1/bucket/card-images":
                if not self._auth_ok():
                    return self._json(401, {})
                return self._json(200, {"id": "card-images"}) if state["bucket"] else self._json(404, {})
            self._json(404, {})

        def do_POST(self):
            if not self._auth_ok():
                return self._json(401, {})
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            if self.path == "/storage/v1/bucket":
                state["bucket"] = json.loads(body)
                return self._json(200, {"name": "card-images"})
            if self.path == "/storage/v1/object/list/card-images":
                return self._json(200, [{"name": n} for n in sorted(state["objects"])])
            if self.path.startswith("/storage/v1/object/card-images/"):
                assert self.headers["Content-Type"] == "image/jpeg"
                state["objects"][self.path.rsplit("/", 1)[1]] = body
                return self._json(200, {"Key": self.path})
            self._json(404, {})

    return ThreadingHTTPServer(("127.0.0.1", 0), H)


def test_sync_uploads_only_missing_images(tmp_path):
    state = {"bucket": None, "objects": {"1.jpg": b"old"}}
    srv = make_server(state)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_port}"
    cards = tmp_path / "cards.json"
    cards.write_text(json.dumps({"cards": [{"id": 1}, {"id": 2}, {"id": 3}, {"id": 404}, {"id": 5, "noImage": True}]}))
    env = {**os.environ, "SUPABASE_URL": base, "SUPABASE_SERVICE_ROLE_KEY": KEY, "IMAGE_SOURCE": f"{base}/img",
           "RATE": "1000", "MAX_DOWNLOADS": "2"}
    out = subprocess.run([sys.executable, "-I", SCRIPT, str(cards)], env=env, capture_output=True, text=True, timeout=60)
    srv.shutdown()
    assert out.returncode == 0, out.stderr
    assert state["bucket"] == {"id": "card-images", "name": "card-images", "public": True}
    assert set(state["objects"]) == {"1.jpg", "2.jpg", "3.jpg"}  # budget 2: ids 2 and 3; 404 waits for next run
    assert state["objects"]["1.jpg"] == b"old"
    assert "left for next run 1" in out.stdout


def test_sync_reports_images_missing_at_source(tmp_path):
    state = {"bucket": {"id": "card-images"}, "objects": {}}
    srv = make_server(state)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_port}"
    cards = tmp_path / "cards.json"
    cards.write_text(json.dumps({"cards": [{"id": 7}, {"id": 404}]}))
    env = {**os.environ, "SUPABASE_URL": base, "SUPABASE_SERVICE_ROLE_KEY": KEY, "IMAGE_SOURCE": f"{base}/img", "RATE": "1000"}
    out = subprocess.run([sys.executable, "-I", SCRIPT, str(cards)], env=env, capture_output=True, text=True, timeout=60)
    srv.shutdown()
    assert out.returncode == 0, out.stderr
    assert set(state["objects"]) == {"7.jpg"}
    assert "not found at source 1" in out.stdout


def test_sync_stops_on_bad_key(tmp_path):
    state = {"bucket": {"id": "card-images"}, "objects": {}}
    srv = make_server(state)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_port}"
    cards = tmp_path / "cards.json"
    cards.write_text(json.dumps({"cards": [{"id": 7}]}))
    env = {**os.environ, "SUPABASE_URL": base, "SUPABASE_SERVICE_ROLE_KEY": "wrong", "IMAGE_SOURCE": f"{base}/img"}
    out = subprocess.run([sys.executable, "-I", SCRIPT, str(cards)], env=env, capture_output=True, text=True, timeout=60)
    srv.shutdown()
    assert out.returncode != 0
    assert state["objects"] == {}
