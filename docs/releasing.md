# Building and releasing binaries

## Release location and visibility

Releases are published in this repository. GitHub applies the repository's
visibility to its Releases page and downloadable assets:

- If this repository is **public**, its source code and the generated source
  archives for tagged releases are public along with the binaries.
- If this repository is **private**, the release and its downloads are
  available only to people who can access the repository.

GitHub Actions can build and publish binaries here, but a release in the same
repository cannot make only the binaries public while keeping that repository's
source private.

## Versioning

Keep the application version in sync in `package.json`, `package-lock.json`,
`Cargo.toml`, `src-tauri/Cargo.toml`, `Cargo.lock`, and
`src-tauri/tauri.conf.json`. For an alpha release, use a tag such as
`v0.2.0-alpha.3`; the release workflow marks tags containing `-` as
pre-releases.

## Build workflows

Manual platform builds are available in:

- `.github/workflows/build-fedora.yml` — Fedora 44 x64 RPM.
- `.github/workflows/build-windows.yml` — Windows x64 NSIS installer.
- `.github/workflows/build-macos.yml` — macOS DMGs for Apple Silicon (arm64)
  and Intel (x64).

The AppStream metadata is maintained in
`src-tauri/metainfo/dk.soundmonitor.desktop.metainfo.xml` and is bundled into
Linux RPM and DEB packages under `/usr/share/metainfo/`.

Start a manual build from the repository's **Actions** tab. The build files are
saved as workflow artifacts.

## Publishing a release

`.github/workflows/release.yml` builds all supported installers when a tag
matching `v*` is pushed. It publishes the GitHub Release only after every
platform build succeeds. It adds Fedora and Windows installers plus both macOS
DMGs. Tags containing a hyphen, such as `v0.2.0-alpha.3`, are marked as
pre-releases.

The publish job uses the workflow's `GITHUB_TOKEN`, with `contents: write` for
this repository. No extra token or public downloads repository is required.

## Node.js in Actions

Build jobs install Node.js 26 using `actions/setup-node@v7` and request the
latest patch release with `check-latest: true`. The workflows use current
GitHub Actions versions (`checkout@v7`, `setup-node@v7`, `upload-artifact@v7`,
and `download-artifact@v8`) whose JavaScript action runtime is Node 24, removing
the deprecated Node 20 action runtime. The Node.js version used to build the
frontend is Node 26.

## macOS signing

The macOS workflows produce DMG installers for arm64 and x64. They do not use
an Apple Developer ID certificate or notarize the app. The current Tauri
configuration uses an ad-hoc signing identity, so macOS may show a security
prompt when users first open the downloaded app. Developer ID signing and
notarization can be added later using Apple credentials stored as GitHub
Actions secrets.

## GitHub references

- [About repository visibility](https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories)
- [About GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- [GitHub Actions `GITHUB_TOKEN`](https://docs.github.com/en/actions/concepts/security/github_token)
- [Tauri macOS DMG distribution](https://v2.tauri.app/distribute/dmg/)
- [GitHub-hosted runner labels and architectures](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
