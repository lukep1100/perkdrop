"""Verify a native Android QA build; never assert store signing or publication."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import zipfile

ANDROID = "{http://schemas.android.com/apk/res/android}"
FORBIDDEN = {
    "android.permission." + name for name in (
        "ACCESS_BACKGROUND_LOCATION", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE",
        "SYSTEM_ALERT_WINDOW", "READ_MEDIA_IMAGES", "READ_MEDIA_VIDEO", "READ_MEDIA_AUDIO",
        "ACCESS_MEDIA_LOCATION", "RECORD_AUDIO", "CAMERA", "SCHEDULE_EXACT_ALARM", "USE_EXACT_ALARM",
    )
} | {"com.google.android.gms.permission.AD_ID"}


def inspect_manifest(xml, version):
    root = ET.fromstring(xml)
    if root.tag != "manifest" or root.get("package") != "au.perkdrop.app":
        raise ValueError("Wrong Android application identity")
    if root.get(ANDROID + "versionName") != version:
        raise ValueError("Android version does not match the reviewed source")
    version_code = int(root.get(ANDROID + "versionCode", "0"))
    if not 0 < version_code <= 2100000000:
        raise ValueError("Invalid Android versionCode")
    sdk = root.find("uses-sdk")
    target = int(sdk.get(ANDROID + "targetSdkVersion", "0")) if sdk is not None else 0
    if target < 36:
        raise ValueError("Google Play requires target API 36 or later for this candidate")
    app = root.find("application")
    if app is None or app.get(ANDROID + "allowBackup") != "false":
        raise ValueError("Private guest access must not be backed up")
    if app.get(ANDROID + "debuggable", "false") != "false":
        raise ValueError("Release QA app must not be debuggable")
    permissions = {node.get(ANDROID + "name", "") for node in root if node.tag.startswith("uses-permission")}
    unsafe = sorted(permissions & FORBIDDEN)
    if unsafe:
        raise ValueError("Unneeded permission in the actual APK: " + ", ".join(unsafe))
    if "android.permission.INTERNET" not in permissions:
        raise ValueError("Required catalogue network permission is missing")
    if not any("android.permission.ACCESS_" + accuracy + "_LOCATION" in permissions for accuracy in ("COARSE", "FINE")):
        raise ValueError("Foreground nearby permission is missing")
    links = []
    for intent in app.findall("activity/intent-filter"):
        if intent.get(ANDROID + "autoVerify") == "true":
            links.extend({key: node.get(ANDROID + key) for key in ("scheme", "host", "pathPrefix")} for node in intent.findall("data"))
    if {"scheme": "https", "host": "perkdrop.au", "pathPrefix": "/deals/"} not in links:
        raise ValueError("The public listing App Link is missing")
    return {"package": root.get("package"), "versionName": version, "versionCode": version_code,
            "targetSdk": target, "permissions": sorted(permissions), "allowBackup": False, "debuggable": False}


def verify_elf_16k(data):
    if len(data) < 64 or data[:5] != b"\x7fELF\x02" or data[5] not in (1, 2):
        raise ValueError("Expected a complete 64-bit ELF library")
    endian = "<" if data[5] == 1 else ">"
    offset = struct.unpack_from(endian + "Q", data, 32)[0]
    size, count = struct.unpack_from(endian + "HH", data, 54)
    if size < 56 or not count or offset + size * count > len(data):
        raise ValueError("Invalid ELF program header table")
    loads = 0
    for i in range(count):
        position = offset + size * i
        if struct.unpack_from(endian + "I", data, position)[0] != 1:
            continue
        loads += 1
        alignment = struct.unpack_from(endian + "Q", data, position + 48)[0]
        if alignment < 16384 or alignment & (alignment - 1):
            raise ValueError("Native library is not aligned for 16 KB memory pages")
    if not loads:
        raise ValueError("ELF library has no loadable segments")


def inspect_packages(apk_path, aab_path):
    with zipfile.ZipFile(apk_path) as apk, zipfile.ZipFile(aab_path) as aab:
        if "assets/index.android.bundle" not in apk.namelist() or "base/assets/index.android.bundle" not in aab.namelist():
            raise ValueError("A native package is missing its embedded app JavaScript")
        libraries = [name for name in apk.namelist() if name.startswith("lib/arm64-v8a/") and name.endswith(".so")]
        if not libraries:
            raise ValueError("No real arm64 Android native libraries were compiled")
        for name in libraries:
            try:
                library = apk.read(name)
                verify_elf_16k(library)
                if "base/" + name not in aab.namelist() or aab.read("base/" + name) != library:
                    raise ValueError("APK and App Bundle native libraries do not match")
            except ValueError as error:
                raise ValueError(name + ": " + str(error)) from error
        if "base/manifest/AndroidManifest.xml" not in aab.namelist():
            raise ValueError("Android App Bundle is missing its base manifest")
        return {"arm64LibrariesChecked": len(libraries), "elfPageAlignment": "16 KB or greater", "embeddedJavaScript": True}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--apk", required=True)
    parser.add_argument("--aab", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    result = {"status": "QA_ONLY_NOT_STORE_SIGNED", "commit": args.commit,
              **inspect_manifest(Path(args.manifest).read_text(), args.version),
              **inspect_packages(args.apk, args.aab),
              "storeSubmission": False, "physicalDeviceTest": False}
    result["sha256"] = {kind: hashlib.sha256(Path(path).read_bytes()).hexdigest() for kind, path in (("apk", args.apk), ("aab", args.aab))}
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
