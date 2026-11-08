import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("android_build", Path(__file__).parents[1] / "scripts/verify-android-build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

MANIFEST = '''<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="au.perkdrop.app" android:versionName="1.1.0" android:versionCode="1">
<uses-sdk android:targetSdkVersion="36"/>
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<application android:allowBackup="false"><activity><intent-filter android:autoVerify="true"><data android:scheme="https" android:host="perkdrop.au" android:pathPrefix="/deals/"/></intent-filter></activity></application></manifest>'''


def elf(alignment=16384):
    data = bytearray(120)
    data[:6] = b"\x7fELF\x02\x01"
    struct.pack_into("<Q", data, 32, 64)
    struct.pack_into("<HH", data, 54, 56, 1)
    struct.pack_into("<I", data, 64, 1)
    struct.pack_into("<Q", data, 112, alignment)
    return bytes(data)


class AndroidBuildTests(unittest.TestCase):
    def test_actual_manifest_identity_and_current_target_are_required(self):
        self.assertEqual(build.inspect_manifest(MANIFEST, "1.1.0")["targetSdk"], 36)
        for changed in [MANIFEST.replace("au.perkdrop.app", "wrong.app"), MANIFEST.replace('targetSdkVersion="36"', 'targetSdkVersion="35"'), MANIFEST.replace('versionCode="1"', 'versionCode="0"'), MANIFEST.replace('versionName="1.1.0"', 'versionName="1.0.0"')]:
            with self.assertRaises(ValueError):
                build.inspect_manifest(changed, "1.1.0")

    def test_merged_sdk_permissions_cannot_reintroduce_background_or_media_access(self):
        for permission in build.FORBIDDEN:
            changed = MANIFEST.replace("<application", '<uses-permission android:name="' + permission + '"/><application')
            with self.assertRaises(ValueError):
                build.inspect_manifest(changed, "1.1.0")

    def test_private_backup_and_debuggable_release_fail_closed(self):
        for changed in [MANIFEST.replace('allowBackup="false"', 'allowBackup="true"'), MANIFEST.replace('android:allowBackup="false"', ''), MANIFEST.replace('<application ', '<application android:debuggable="true" ')]:
            with self.assertRaises(ValueError):
                build.inspect_manifest(changed, "1.1.0")

    def test_own_public_link_and_network_access_are_preserved(self):
        for changed in [MANIFEST.replace('/deals/', '/admin/'), MANIFEST.replace('android.permission.INTERNET', 'unused.permission'), MANIFEST.replace('ACCESS_COARSE_LOCATION', 'unused.location')]:
            with self.assertRaises(ValueError):
                build.inspect_manifest(changed, "1.1.0")

    def test_native_page_alignment_checks_loadable_segments_not_a_filename(self):
        build.verify_elf_16k(elf())
        build.verify_elf_16k(elf(65536))
        for data in [elf(4096), elf(20000), elf()[:80], b"not a library"]:
            with self.assertRaises(ValueError):
                build.verify_elf_16k(data)

    def test_bundle_must_embed_the_app_and_match_the_checked_native_libraries(self):
        with tempfile.TemporaryDirectory() as directory:
            apk, aab = Path(directory) / 'qa.apk', Path(directory) / 'qa.aab'
            with zipfile.ZipFile(apk, 'w') as archive:
                archive.writestr('assets/index.android.bundle', b'app')
                archive.writestr('lib/arm64-v8a/libexample.so', elf())
            def bundle(library=elf(), javascript=True):
                with zipfile.ZipFile(aab, 'w') as archive:
                    archive.writestr('base/manifest/AndroidManifest.xml', b'compiled manifest')
                    archive.writestr('base/lib/arm64-v8a/libexample.so', library)
                    if javascript:
                        archive.writestr('base/assets/index.android.bundle', b'app')
            bundle()
            self.assertEqual(build.inspect_packages(apk, aab)['arm64LibrariesChecked'], 1)
            for kwargs in [{'library': elf(65536)}, {'javascript': False}]:
                bundle(**kwargs)
                with self.assertRaises(ValueError):
                    build.inspect_packages(apk, aab)


if __name__ == "__main__":
    unittest.main()
