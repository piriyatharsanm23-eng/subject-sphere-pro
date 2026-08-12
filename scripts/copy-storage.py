#!/usr/bin/env python3
"""Copy every file in the learning-materials and avatars buckets from the
Lovable Cloud project to the external Supabase project.

Run through scripts/migrate-cloud-to-external.sh, or directly once the
source project is awake."""
import os
import sys
import urllib.request
import json

SRC_URL = os.environ["SUPABASE_URL"].rstrip("/")
SRC_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DST_URL = os.environ["EXTERNAL_SUPABASE_URL"].rstrip("/")
DST_KEY = os.environ["EXTERNAL_SUPABASE_SERVICE_ROLE_KEY"]
BUCKETS = ["learning-materials", "avatars"]


def req(url, key, method="GET", data=None, headers=None, raw=False):
    h = {"apikey": key, "Authorization": f"Bearer {key}"}
    if headers:
        h.update(headers)
    body = None
    if data is not None:
        body = data if raw else json.dumps(data).encode()
        if not raw:
            h["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    with urllib.request.urlopen(r) as resp:
        return resp.read()


def listing(bucket, prefix=""):
    """Recursively yield object paths inside a bucket."""
    offset = 0
    while True:
        payload = {
            "prefix": prefix,
            "limit": 100,
            "offset": offset,
            "sortBy": {"column": "name", "order": "asc"},
        }
        items = json.loads(
            req(f"{SRC_URL}/storage/v1/object/list/{bucket}", SRC_KEY, "POST", payload)
        )
        if not items:
            return
        for it in items:
            name = f"{prefix}{it['name']}"
            if it.get("id") is None:  # folder
                yield from listing(bucket, name + "/")
            else:
                yield name
        offset += len(items)


def main():
    total = 0
    for bucket in BUCKETS:
        for path in listing(bucket):
            blob = req(f"{SRC_URL}/storage/v1/object/{bucket}/{path}", SRC_KEY)
            try:
                req(
                    f"{DST_URL}/storage/v1/object/{bucket}/{path}",
                    DST_KEY,
                    "POST",
                    blob,
                    headers={
                        "Content-Type": "application/octet-stream",
                        "x-upsert": "true",
                    },
                    raw=True,
                )
                total += 1
                print(f"  copied {bucket}/{path}")
            except Exception as exc:  # keep going, report at the end
                print(f"  FAILED {bucket}/{path}: {exc}", file=sys.stderr)
    print(f"{total} files copied")


if __name__ == "__main__":
    main()
