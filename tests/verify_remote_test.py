import datetime
import io
import json
import os
import subprocess
import textwrap
import time
import unittest
import urllib.request
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

SHA = "a" * 40
DIGEST = "sha256:" + "b" * 64
IMAGE = "ghcr.io/nocoo/hackernews-on-this-day"
REFERENCE = IMAGE + "@" + DIGEST
DIRECTORY = "/tmp/hntoday-remote-fixture"
VERSION = json.loads(Path("package.json").read_text())["version"]


class FixedDateTime(datetime.datetime):
    @classmethod
    def now(cls, tz=None):
        return cls(2026, 11, 12, 12, tzinfo=tz)


def remote_code():
    source = Path(".github/workflows/release.yml").read_text()
    fragment = source.split("python3 - <<'PY'\n", 1)[1].split("\n        PY\n", 1)[0]
    return compile(textwrap.dedent(fragment), "<remote-verify>", "exec")


class Response:
    def __init__(self, value, content_type="application/json"):
        self.status = 200
        self.headers = {"Cache-Control": "no-store", "Content-Type": content_type}
        self.body = value if isinstance(value, bytes) else json.dumps(value).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self.body


def run_remote(*, writable=False, revision=SHA, image_revision=SHA, container_revision=SHA,
               live_version=VERSION, mounted_source=DIRECTORY + "/data", release_digest=DIGEST,
               missing=None, stories=None, wrong_date=False):
    now = FixedDateTime.now(datetime.timezone.utc)
    releases = [{"image": IMAGE, "service": "web", "sourceSha": SHA, "digest": release_digest}]
    image = {"Id": "image-id", "RepoDigests": [REFERENCE], "Config": {"Labels": {"org.opencontainers.image.revision": image_revision}}}
    container = {
        "Image": "image-id",
        "Config": {"Image": REFERENCE, "Env": ["APP_REVISION=" + container_revision]},
        "Mounts": [{"Destination": "/data", "Type": "bind", "RW": writable, "Source": mounted_source}],
    }
    archive = {
        "month": now.month - 1 if wrong_date else now.month,
        "day": now.day,
        "years": [{"year": now.year - 1, "stories": stories if stories is not None else [{"id": 1, "title": "Fixture"}]}],
        "missingYears": missing if missing is not None else [],
    }

    def docker(command, **_kwargs):
        if command[:3] == ["docker", "image", "inspect"]:
            return json.dumps([image])
        if command == ["docker", "inspect", "hntoday-app"]:
            return json.dumps([container])
        if command[:4] == ["docker", "exec", "hntoday-app", "node"]:
            return VERSION
        raise AssertionError("Unexpected Docker command")

    def request(url, **_kwargs):
        if url.endswith("/api/live"):
            return Response({"status": "ok", "component": "hntoday", "version": live_version, "revision": revision})
        if "/api/day?" in url:
            return Response(archive)
        if url == "http://127.0.0.1:17065/":
            return Response(b"<title>Hacker News</title>", "text/html")
        raise AssertionError("Unexpected HTTP request")

    class Opener:
        def open(self, url, **kwargs):
            return request(url, **kwargs)

    env = {"IMAGE_SHA": SHA, "RELEASE_IMAGES": json.dumps(releases), "DEPLOY_DIRECTORY": DIRECTORY}
    with patch.dict(os.environ, env), patch.object(subprocess, "check_output", docker), patch.object(
        urllib.request, "build_opener", return_value=Opener()
    ), patch.object(datetime, "datetime", FixedDateTime), patch.object(time, "sleep", lambda _seconds: None), redirect_stdout(io.StringIO()):
        exec(remote_code(), {"__name__": "__main__"})


class RemoteVerificationTests(unittest.TestCase):
    def test_accepts_matching_image_read_only_archive_and_live_data(self):
        run_remote()

    def test_rejects_wrong_revision_writable_or_incomplete_archive(self):
        for options in [
            {"revision": "c" * 40},
            {"live_version": "0.0.0"},
            {"image_revision": "c" * 40},
            {"container_revision": "c" * 40},
            {"release_digest": "latest"},
            {"mounted_source": "/tmp/unrelated"},
            {"writable": True},
            {"missing": [2025]},
            {"stories": []},
            {"stories": [{"id": 1, "title": ""}]},
            {"wrong_date": True},
        ]:
            with self.subTest(options=options), self.assertRaises(SystemExit):
                run_remote(**options)


if __name__ == "__main__":
    unittest.main()
