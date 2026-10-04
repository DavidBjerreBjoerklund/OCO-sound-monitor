# Third-party license inventory

Generated on 2026-10-04 from the locked dependencies in `Cargo.lock` and `package-lock.json`. It lists upstream package versions and license expressions as declared in Cargo/npm metadata; registry links point to the package records.

This lockfile-wide inventory helps identify applicable notices. It is not a substitute for the license texts or copyright notices supplied by upstream packages. Third-party components retain their own license terms. Platform-specific builds may use only a subset of these packages.

## Compatibility notes

The application code is licensed under `GPL-3.0-or-later`; this does not replace dependency licenses. Where a dependency offers a choice of licenses, the distributor may use a compatible option. In particular, the locked `unescaper` crate offers MIT or GPL-3.0-only, and `r-efi` offers MIT, Apache-2.0, or LGPL-2.1-or-later; the permissive MIT option is available for each. The inventory preserves upstream alternatives rather than treating every alternative as simultaneously applied.

The locked dependency set includes MPL-2.0 packages. Mozilla permits an MPL-2.0 component to be distributed within a GPL larger work under section 3.3 if that component is not marked incompatible with secondary licenses; the source packages checked at these locked versions had no such incompatibility notice. MPL-covered files remain subject to their MPL notices and source-availability terms ([Mozilla MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/)). The declared `Unicode-3.0` licenses are GPL-compatible according to the [Free Software Foundation's license list](https://www.gnu.org/licenses/license-list.html.html).

For Fedora packaging, this lockfile-wide inventory is a starting point, not the final RPM `License:` expression: Fedora requires that field to describe the contents of the built RPM and requires applicable license texts to be included as `%license` files when present in the source package ([Fedora licensing guidelines](https://fedoraproject.org/wiki/Packaging%3ALicensingGuidelines)).

## Rust crates

457 registry packages; 30 distinct declared license expressions.

| Package | Version | Declared license expression |
| --- | --- | --- |
| [adler2](https://crates.io/crates/adler2/2.0.1) | `2.0.1` | `0BSD OR MIT OR Apache-2.0` |
| [aho-corasick](https://crates.io/crates/aho-corasick/1.1.5) | `1.1.5` | `Unlicense OR MIT` |
| [alloc-no-stdlib](https://crates.io/crates/alloc-no-stdlib/2.0.4) | `2.0.4` | `BSD-3-Clause` |
| [alloc-stdlib](https://crates.io/crates/alloc-stdlib/0.2.4) | `0.2.4` | `BSD-3-Clause` |
| [android_system_properties](https://crates.io/crates/android_system_properties/0.1.6) | `0.1.6` | `MIT OR Apache-2.0` |
| [anyhow](https://crates.io/crates/anyhow/1.0.104) | `1.0.104` | `MIT OR Apache-2.0` |
| [atk](https://crates.io/crates/atk/0.18.2) | `0.18.2` | `MIT` |
| [atk-sys](https://crates.io/crates/atk-sys/0.18.2) | `0.18.2` | `MIT` |
| [atomic-waker](https://crates.io/crates/atomic-waker/1.1.2) | `1.1.2` | `Apache-2.0 OR MIT` |
| [autocfg](https://crates.io/crates/autocfg/1.5.1) | `1.5.1` | `Apache-2.0 OR MIT` |
| [base64](https://crates.io/crates/base64/0.21.7) | `0.21.7` | `MIT OR Apache-2.0` |
| [base64](https://crates.io/crates/base64/0.22.1) | `0.22.1` | `MIT OR Apache-2.0` |
| [bit-set](https://crates.io/crates/bit-set/0.8.0) | `0.8.0` | `Apache-2.0 OR MIT` |
| [bit-vec](https://crates.io/crates/bit-vec/0.8.0) | `0.8.0` | `Apache-2.0 OR MIT` |
| [bitflags](https://crates.io/crates/bitflags/1.3.2) | `1.3.2` | `MIT/Apache-2.0` |
| [bitflags](https://crates.io/crates/bitflags/2.13.1) | `2.13.1` | `MIT OR Apache-2.0` |
| [block-buffer](https://crates.io/crates/block-buffer/0.10.4) | `0.10.4` | `MIT OR Apache-2.0` |
| [block2](https://crates.io/crates/block2/0.6.2) | `0.6.2` | `MIT` |
| [brotli](https://crates.io/crates/brotli/8.0.4) | `8.0.4` | `BSD-3-Clause AND MIT` |
| [brotli-decompressor](https://crates.io/crates/brotli-decompressor/5.0.3) | `5.0.3` | `BSD-3-Clause/MIT` |
| [bs58](https://crates.io/crates/bs58/0.5.1) | `0.5.1` | `MIT/Apache-2.0` |
| [bumpalo](https://crates.io/crates/bumpalo/3.20.3) | `3.20.3` | `MIT OR Apache-2.0` |
| [bytemuck](https://crates.io/crates/bytemuck/1.25.2) | `1.25.2` | `Zlib OR Apache-2.0 OR MIT` |
| [byteorder](https://crates.io/crates/byteorder/1.5.0) | `1.5.0` | `Unlicense OR MIT` |
| [bytes](https://crates.io/crates/bytes/1.12.1) | `1.12.1` | `MIT` |
| [cairo-rs](https://crates.io/crates/cairo-rs/0.18.5) | `0.18.5` | `MIT` |
| [cairo-sys-rs](https://crates.io/crates/cairo-sys-rs/0.18.2) | `0.18.2` | `MIT` |
| [camino](https://crates.io/crates/camino/1.2.5) | `1.2.5` | `MIT OR Apache-2.0` |
| [cargo-platform](https://crates.io/crates/cargo-platform/0.1.9) | `0.1.9` | `MIT OR Apache-2.0` |
| [cargo_metadata](https://crates.io/crates/cargo_metadata/0.19.2) | `0.19.2` | `MIT` |
| [cargo_toml](https://crates.io/crates/cargo_toml/0.22.3) | `0.22.3` | `Apache-2.0 OR MIT` |
| [cc](https://crates.io/crates/cc/1.4.4) | `1.4.4` | `MIT OR Apache-2.0` |
| [cesu8](https://crates.io/crates/cesu8/1.1.0) | `1.1.0` | `Apache-2.0/MIT` |
| [cfb](https://crates.io/crates/cfb/0.7.3) | `0.7.3` | `MIT` |
| [cfg-expr](https://crates.io/crates/cfg-expr/0.15.8) | `0.15.8` | `MIT OR Apache-2.0` |
| [cfg-if](https://crates.io/crates/cfg-if/1.0.4) | `1.0.4` | `MIT OR Apache-2.0` |
| [chrono](https://crates.io/crates/chrono/0.4.45) | `0.4.45` | `MIT OR Apache-2.0` |
| [chrono-tz](https://crates.io/crates/chrono-tz/0.10.4) | `0.10.4` | `MIT OR Apache-2.0` |
| [combine](https://crates.io/crates/combine/4.6.8) | `4.6.8` | `MIT` |
| [cookie](https://crates.io/crates/cookie/0.18.2) | `0.18.2` | `MIT OR Apache-2.0` |
| [core-foundation](https://crates.io/crates/core-foundation/0.10.1) | `0.10.1` | `MIT OR Apache-2.0` |
| [core-foundation-sys](https://crates.io/crates/core-foundation-sys/0.8.7) | `0.8.7` | `MIT OR Apache-2.0` |
| [core-graphics](https://crates.io/crates/core-graphics/0.25.0) | `0.25.0` | `MIT OR Apache-2.0` |
| [core-graphics-types](https://crates.io/crates/core-graphics-types/0.2.0) | `0.2.0` | `MIT OR Apache-2.0` |
| [cpufeatures](https://crates.io/crates/cpufeatures/0.2.17) | `0.2.17` | `MIT OR Apache-2.0` |
| [crc32fast](https://crates.io/crates/crc32fast/1.5.1) | `1.5.1` | `MIT OR Apache-2.0` |
| [crossbeam-channel](https://crates.io/crates/crossbeam-channel/0.5.16) | `0.5.16` | `MIT OR Apache-2.0` |
| [crossbeam-utils](https://crates.io/crates/crossbeam-utils/0.8.22) | `0.8.22` | `MIT OR Apache-2.0` |
| [crypto-common](https://crates.io/crates/crypto-common/0.1.7) | `0.1.7` | `MIT OR Apache-2.0` |
| [cssparser](https://crates.io/crates/cssparser/0.36.0) | `0.36.0` | `MPL-2.0` |
| [cssparser-macros](https://crates.io/crates/cssparser-macros/0.6.1) | `0.6.1` | `MPL-2.0` |
| [ctor](https://crates.io/crates/ctor/0.8.0) | `0.8.0` | `Apache-2.0 OR MIT` |
| [ctor-proc-macro](https://crates.io/crates/ctor-proc-macro/0.0.7) | `0.0.7` | `Apache-2.0 OR MIT` |
| [darling](https://crates.io/crates/darling/0.23.0) | `0.23.0` | `MIT` |
| [darling_core](https://crates.io/crates/darling_core/0.23.0) | `0.23.0` | `MIT` |
| [darling_macro](https://crates.io/crates/darling_macro/0.23.0) | `0.23.0` | `MIT` |
| [dbus](https://crates.io/crates/dbus/0.9.12) | `0.9.12` | `Apache-2.0/MIT` |
| [defmt](https://crates.io/crates/defmt/1.1.1) | `1.1.1` | `MIT OR Apache-2.0` |
| [defmt-macros](https://crates.io/crates/defmt-macros/1.1.1) | `1.1.1` | `MIT OR Apache-2.0` |
| [defmt-parser](https://crates.io/crates/defmt-parser/1.0.0) | `1.0.0` | `MIT OR Apache-2.0` |
| [deranged](https://crates.io/crates/deranged/0.5.8) | `0.5.8` | `MIT OR Apache-2.0` |
| [derive_more](https://crates.io/crates/derive_more/2.1.1) | `2.1.1` | `MIT` |
| [derive_more-impl](https://crates.io/crates/derive_more-impl/2.1.1) | `2.1.1` | `MIT` |
| [digest](https://crates.io/crates/digest/0.10.7) | `0.10.7` | `MIT OR Apache-2.0` |
| [dirs](https://crates.io/crates/dirs/6.0.0) | `6.0.0` | `MIT OR Apache-2.0` |
| [dirs-sys](https://crates.io/crates/dirs-sys/0.5.0) | `0.5.0` | `MIT OR Apache-2.0` |
| [dispatch2](https://crates.io/crates/dispatch2/0.3.1) | `0.3.1` | `Zlib OR Apache-2.0 OR MIT` |
| [displaydoc](https://crates.io/crates/displaydoc/0.2.7) | `0.2.7` | `MIT OR Apache-2.0` |
| [dlopen2](https://crates.io/crates/dlopen2/0.8.2) | `0.8.2` | `MIT` |
| [dlopen2_derive](https://crates.io/crates/dlopen2_derive/0.4.3) | `0.4.3` | `MIT` |
| [dom_query](https://crates.io/crates/dom_query/0.27.0) | `0.27.0` | `MIT` |
| [dpi](https://crates.io/crates/dpi/0.1.2) | `0.1.2` | `Apache-2.0 AND MIT` |
| [dtoa](https://crates.io/crates/dtoa/1.0.11) | `1.0.11` | `MIT OR Apache-2.0` |
| [dtoa-short](https://crates.io/crates/dtoa-short/0.3.5) | `0.3.5` | `MPL-2.0` |
| [dtor](https://crates.io/crates/dtor/0.3.0) | `0.3.0` | `Apache-2.0 OR MIT` |
| [dtor-proc-macro](https://crates.io/crates/dtor-proc-macro/0.0.6) | `0.0.6` | `Apache-2.0 OR MIT` |
| [dunce](https://crates.io/crates/dunce/1.0.5) | `1.0.5` | `CC0-1.0 OR MIT-0 OR Apache-2.0` |
| [dyn-clone](https://crates.io/crates/dyn-clone/1.0.20) | `1.0.20` | `MIT OR Apache-2.0` |
| [embed-resource](https://crates.io/crates/embed-resource/3.0.11) | `3.0.11` | `MIT` |
| [embed_plist](https://crates.io/crates/embed_plist/1.2.2) | `1.2.2` | `MIT OR Apache-2.0` |
| [equivalent](https://crates.io/crates/equivalent/1.0.2) | `1.0.2` | `Apache-2.0 OR MIT` |
| [erased-serde](https://crates.io/crates/erased-serde/0.4.10) | `0.4.10` | `MIT OR Apache-2.0` |
| [errno](https://crates.io/crates/errno/0.3.14) | `0.3.14` | `MIT OR Apache-2.0` |
| [fastrand](https://crates.io/crates/fastrand/2.5.0) | `2.5.0` | `Apache-2.0 OR MIT` |
| [fdeflate](https://crates.io/crates/fdeflate/0.3.7) | `0.3.7` | `MIT OR Apache-2.0` |
| [field-offset](https://crates.io/crates/field-offset/0.3.6) | `0.3.6` | `MIT OR Apache-2.0` |
| [find-msvc-tools](https://crates.io/crates/find-msvc-tools/0.1.11) | `0.1.11` | `MIT OR Apache-2.0` |
| [flate2](https://crates.io/crates/flate2/1.1.10) | `1.1.10` | `MIT OR Apache-2.0` |
| [fnv](https://crates.io/crates/fnv/1.0.7) | `1.0.7` | `Apache-2.0 / MIT` |
| [foldhash](https://crates.io/crates/foldhash/0.2.0) | `0.2.0` | `Zlib` |
| [foreign-types](https://crates.io/crates/foreign-types/0.5.0) | `0.5.0` | `MIT/Apache-2.0` |
| [foreign-types-macros](https://crates.io/crates/foreign-types-macros/0.2.4) | `0.2.4` | `MIT/Apache-2.0` |
| [foreign-types-shared](https://crates.io/crates/foreign-types-shared/0.3.1) | `0.3.1` | `MIT/Apache-2.0` |
| [form_urlencoded](https://crates.io/crates/form_urlencoded/1.2.2) | `1.2.2` | `MIT OR Apache-2.0` |
| [futures-channel](https://crates.io/crates/futures-channel/0.3.34) | `0.3.34` | `MIT OR Apache-2.0` |
| [futures-core](https://crates.io/crates/futures-core/0.3.34) | `0.3.34` | `MIT OR Apache-2.0` |
| [futures-executor](https://crates.io/crates/futures-executor/0.3.34) | `0.3.34` | `MIT OR Apache-2.0` |
| [futures-io](https://crates.io/crates/futures-io/0.3.34) | `0.3.34` | `MIT OR Apache-2.0` |
| [futures-macro](https://crates.io/crates/futures-macro/0.3.34) | `0.3.34` | `MIT OR Apache-2.0` |
| [futures-sink](https://crates.io/crates/futures-sink/0.3.34) | `0.3.34` | `MIT OR Apache-2.0` |
| [futures-task](https://crates.io/crates/futures-task/0.3.34) | `0.3.34` | `MIT OR Apache-2.0` |
| [futures-util](https://crates.io/crates/futures-util/0.3.34) | `0.3.34` | `MIT OR Apache-2.0` |
| [gdk](https://crates.io/crates/gdk/0.18.2) | `0.18.2` | `MIT` |
| [gdk-pixbuf](https://crates.io/crates/gdk-pixbuf/0.18.5) | `0.18.5` | `MIT` |
| [gdk-pixbuf-sys](https://crates.io/crates/gdk-pixbuf-sys/0.18.0) | `0.18.0` | `MIT` |
| [gdk-sys](https://crates.io/crates/gdk-sys/0.18.2) | `0.18.2` | `MIT` |
| [gdkwayland-sys](https://crates.io/crates/gdkwayland-sys/0.18.2) | `0.18.2` | `MIT` |
| [gdkx11](https://crates.io/crates/gdkx11/0.18.2) | `0.18.2` | `MIT` |
| [gdkx11-sys](https://crates.io/crates/gdkx11-sys/0.18.2) | `0.18.2` | `MIT` |
| [generic-array](https://crates.io/crates/generic-array/0.14.7) | `0.14.7` | `MIT` |
| [getrandom](https://crates.io/crates/getrandom/0.2.17) | `0.2.17` | `MIT OR Apache-2.0` |
| [getrandom](https://crates.io/crates/getrandom/0.3.4) | `0.3.4` | `MIT OR Apache-2.0` |
| [getrandom](https://crates.io/crates/getrandom/0.4.3) | `0.4.3` | `MIT OR Apache-2.0` |
| [gio](https://crates.io/crates/gio/0.18.4) | `0.18.4` | `MIT` |
| [gio-sys](https://crates.io/crates/gio-sys/0.18.1) | `0.18.1` | `MIT` |
| [glib](https://crates.io/crates/glib/0.18.5) | `0.18.5` | `MIT` |
| [glib-macros](https://crates.io/crates/glib-macros/0.18.5) | `0.18.5` | `MIT` |
| [glib-sys](https://crates.io/crates/glib-sys/0.18.1) | `0.18.1` | `MIT` |
| [glob](https://crates.io/crates/glob/0.3.4) | `0.3.4` | `MIT OR Apache-2.0` |
| [gobject-sys](https://crates.io/crates/gobject-sys/0.18.0) | `0.18.0` | `MIT` |
| [gtk](https://crates.io/crates/gtk/0.18.2) | `0.18.2` | `MIT` |
| [gtk-sys](https://crates.io/crates/gtk-sys/0.18.2) | `0.18.2` | `MIT` |
| [gtk3-macros](https://crates.io/crates/gtk3-macros/0.18.2) | `0.18.2` | `MIT` |
| [hashbrown](https://crates.io/crates/hashbrown/0.12.3) | `0.12.3` | `MIT OR Apache-2.0` |
| [hashbrown](https://crates.io/crates/hashbrown/0.17.1) | `0.17.1` | `MIT OR Apache-2.0` |
| [heck](https://crates.io/crates/heck/0.4.1) | `0.4.1` | `MIT OR Apache-2.0` |
| [heck](https://crates.io/crates/heck/0.5.0) | `0.5.0` | `MIT OR Apache-2.0` |
| [hex](https://crates.io/crates/hex/0.4.3) | `0.4.3` | `MIT OR Apache-2.0` |
| [html5ever](https://crates.io/crates/html5ever/0.38.0) | `0.38.0` | `MIT OR Apache-2.0` |
| [http](https://crates.io/crates/http/1.5.0) | `1.5.0` | `MIT OR Apache-2.0` |
| [http-body](https://crates.io/crates/http-body/1.1.0) | `1.1.0` | `MIT` |
| [http-body-util](https://crates.io/crates/http-body-util/0.1.5) | `0.1.5` | `MIT` |
| [httparse](https://crates.io/crates/httparse/1.10.1) | `1.10.1` | `MIT OR Apache-2.0` |
| [hyper](https://crates.io/crates/hyper/1.11.0) | `1.11.0` | `MIT` |
| [hyper-util](https://crates.io/crates/hyper-util/0.1.20) | `0.1.20` | `MIT` |
| [iana-time-zone](https://crates.io/crates/iana-time-zone/0.1.65) | `0.1.65` | `MIT OR Apache-2.0` |
| [iana-time-zone-haiku](https://crates.io/crates/iana-time-zone-haiku/0.1.2) | `0.1.2` | `MIT OR Apache-2.0` |
| [ico](https://crates.io/crates/ico/0.5.0) | `0.5.0` | `MIT` |
| [icu_collections](https://crates.io/crates/icu_collections/2.3.0) | `2.3.0` | `Unicode-3.0` |
| [icu_locale_core](https://crates.io/crates/icu_locale_core/2.3.0) | `2.3.0` | `Unicode-3.0` |
| [icu_normalizer](https://crates.io/crates/icu_normalizer/2.3.0) | `2.3.0` | `Unicode-3.0` |
| [icu_normalizer_data](https://crates.io/crates/icu_normalizer_data/2.3.0) | `2.3.0` | `Unicode-3.0` |
| [icu_properties](https://crates.io/crates/icu_properties/2.3.0) | `2.3.0` | `Unicode-3.0` |
| [icu_properties_data](https://crates.io/crates/icu_properties_data/2.3.0) | `2.3.0` | `Unicode-3.0` |
| [icu_provider](https://crates.io/crates/icu_provider/2.3.1) | `2.3.1` | `Unicode-3.0` |
| [ident_case](https://crates.io/crates/ident_case/1.0.1) | `1.0.1` | `MIT/Apache-2.0` |
| [idna](https://crates.io/crates/idna/1.1.0) | `1.1.0` | `MIT OR Apache-2.0` |
| [idna_adapter](https://crates.io/crates/idna_adapter/1.2.2) | `1.2.2` | `Apache-2.0 OR MIT` |
| [indexmap](https://crates.io/crates/indexmap/1.9.3) | `1.9.3` | `Apache-2.0 OR MIT` |
| [indexmap](https://crates.io/crates/indexmap/2.14.0) | `2.14.0` | `Apache-2.0 OR MIT` |
| [infer](https://crates.io/crates/infer/0.19.0) | `0.19.0` | `MIT` |
| [io-kit-sys](https://crates.io/crates/io-kit-sys/0.4.1) | `0.4.1` | `MIT / Apache-2.0` |
| [ipnet](https://crates.io/crates/ipnet/2.12.1) | `2.12.1` | `MIT OR Apache-2.0` |
| [itoa](https://crates.io/crates/itoa/1.0.18) | `1.0.18` | `MIT OR Apache-2.0` |
| [javascriptcore-rs](https://crates.io/crates/javascriptcore-rs/1.1.2) | `1.1.2` | `MIT` |
| [javascriptcore-rs-sys](https://crates.io/crates/javascriptcore-rs-sys/1.1.1) | `1.1.1` | `MIT` |
| [jiff](https://crates.io/crates/jiff/0.2.35) | `0.2.35` | `Unlicense OR MIT` |
| [jiff-core](https://crates.io/crates/jiff-core/0.1.0) | `0.1.0` | `Unlicense OR MIT` |
| [jiff-static](https://crates.io/crates/jiff-static/0.2.35) | `0.2.35` | `Unlicense OR MIT` |
| [jiff-tzdb](https://crates.io/crates/jiff-tzdb/0.1.8) | `0.1.8` | `Unlicense OR MIT` |
| [jiff-tzdb-platform](https://crates.io/crates/jiff-tzdb-platform/0.1.3) | `0.1.3` | `Unlicense OR MIT` |
| [jni](https://crates.io/crates/jni/0.21.1) | `0.21.1` | `MIT/Apache-2.0` |
| [jni-sys](https://crates.io/crates/jni-sys/0.3.1) | `0.3.1` | `MIT OR Apache-2.0` |
| [jni-sys](https://crates.io/crates/jni-sys/0.4.1) | `0.4.1` | `MIT OR Apache-2.0` |
| [jni-sys-macros](https://crates.io/crates/jni-sys-macros/0.4.1) | `0.4.1` | `MIT OR Apache-2.0` |
| [js-sys](https://crates.io/crates/js-sys/0.3.104) | `0.3.104` | `MIT OR Apache-2.0` |
| [json-patch](https://crates.io/crates/json-patch/3.0.1) | `3.0.1` | `MIT/Apache-2.0` |
| [jsonptr](https://crates.io/crates/jsonptr/0.6.3) | `0.6.3` | `MIT OR Apache-2.0` |
| [keyboard-types](https://crates.io/crates/keyboard-types/0.7.0) | `0.7.0` | `MIT OR Apache-2.0` |
| [libappindicator](https://crates.io/crates/libappindicator/0.9.0) | `0.9.0` | `Apache-2.0 OR MIT` |
| [libappindicator-sys](https://crates.io/crates/libappindicator-sys/0.9.0) | `0.9.0` | `Apache-2.0 OR MIT` |
| [libc](https://crates.io/crates/libc/0.2.189) | `0.2.189` | `MIT OR Apache-2.0` |
| [libdbus-sys](https://crates.io/crates/libdbus-sys/0.2.7) | `0.2.7` | `Apache-2.0/MIT` |
| [libloading](https://crates.io/crates/libloading/0.7.4) | `0.7.4` | `ISC` |
| [libredox](https://crates.io/crates/libredox/0.1.21) | `0.1.21` | `MIT` |
| [linux-raw-sys](https://crates.io/crates/linux-raw-sys/0.12.1) | `0.12.1` | `Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT` |
| [litemap](https://crates.io/crates/litemap/0.8.3) | `0.8.3` | `Unicode-3.0` |
| [lock_api](https://crates.io/crates/lock_api/0.4.14) | `0.4.14` | `MIT OR Apache-2.0` |
| [log](https://crates.io/crates/log/0.4.34) | `0.4.34` | `MIT OR Apache-2.0` |
| [mach2](https://crates.io/crates/mach2/0.4.3) | `0.4.3` | `BSD-2-Clause OR MIT OR Apache-2.0` |
| [markup5ever](https://crates.io/crates/markup5ever/0.38.0) | `0.38.0` | `MIT OR Apache-2.0` |
| [memchr](https://crates.io/crates/memchr/2.8.3) | `2.8.3` | `Unlicense OR MIT` |
| [memoffset](https://crates.io/crates/memoffset/0.9.1) | `0.9.1` | `MIT` |
| [mime](https://crates.io/crates/mime/0.3.17) | `0.3.17` | `MIT OR Apache-2.0` |
| [miniz_oxide](https://crates.io/crates/miniz_oxide/0.8.9) | `0.8.9` | `MIT OR Zlib OR Apache-2.0` |
| [miniz_oxide](https://crates.io/crates/miniz_oxide/0.9.1) | `0.9.1` | `MIT OR Zlib OR Apache-2.0` |
| [mio](https://crates.io/crates/mio/1.2.2) | `1.2.2` | `MIT` |
| [muda](https://crates.io/crates/muda/0.19.3) | `0.19.3` | `Apache-2.0 OR MIT` |
| [ndk](https://crates.io/crates/ndk/0.9.0) | `0.9.0` | `MIT OR Apache-2.0` |
| [ndk-sys](https://crates.io/crates/ndk-sys/0.6.0+11769913) | `0.6.0+11769913` | `MIT OR Apache-2.0` |
| [new_debug_unreachable](https://crates.io/crates/new_debug_unreachable/1.0.6) | `1.0.6` | `MIT` |
| [nix](https://crates.io/crates/nix/0.26.4) | `0.26.4` | `MIT` |
| [num-conv](https://crates.io/crates/num-conv/0.2.2) | `0.2.2` | `MIT OR Apache-2.0` |
| [num-traits](https://crates.io/crates/num-traits/0.2.19) | `0.2.19` | `MIT OR Apache-2.0` |
| [num_enum](https://crates.io/crates/num_enum/0.7.6) | `0.7.6` | `BSD-3-Clause OR MIT OR Apache-2.0` |
| [num_enum_derive](https://crates.io/crates/num_enum_derive/0.7.6) | `0.7.6` | `BSD-3-Clause OR MIT OR Apache-2.0` |
| [objc2](https://crates.io/crates/objc2/0.6.4) | `0.6.4` | `MIT` |
| [objc2-app-kit](https://crates.io/crates/objc2-app-kit/0.3.2) | `0.3.2` | `Zlib OR Apache-2.0 OR MIT` |
| [objc2-cloud-kit](https://crates.io/crates/objc2-cloud-kit/0.3.2) | `0.3.2` | `Zlib OR Apache-2.0 OR MIT` |
| [objc2-core-data](https://crates.io/crates/objc2-core-data/0.3.2) | `0.3.2` | `Zlib OR Apache-2.0 OR MIT` |
| [objc2-core-foundation](https://crates.io/crates/objc2-core-foundation/0.3.2) | `0.3.2` | `Zlib OR Apache-2.0 OR MIT` |
| [objc2-core-graphics](https://crates.io/crates/objc2-core-graphics/0.3.2) | `0.3.2` | `Zlib OR Apache-2.0 OR MIT` |
| [objc2-core-image](https://crates.io/crates/objc2-core-image/0.3.2) | `0.3.2` | `Zlib OR Apache-2.0 OR MIT` |
| [objc2-core-location](https://crates.io/crates/objc2-core-location/0.3.2) | `0.3.2` | `Zlib OR Apache-2.0 OR MIT` |
| [objc2-core-text](https://crates.io/crates/objc2-core-text/0.3.2) | `0.3.2` | `Zlib OR Apache-2.0 OR MIT` |
| [objc2-encode](https://crates.io/crates/objc2-encode/4.1.0) | `4.1.0` | `MIT` |
| [objc2-exception-helper](https://crates.io/crates/objc2-exception-helper/0.1.1) | `0.1.1` | `Zlib OR Apache-2.0 OR MIT` |
| [objc2-foundation](https://crates.io/crates/objc2-foundation/0.3.2) | `0.3.2` | `MIT` |
| [objc2-io-surface](https://crates.io/crates/objc2-io-surface/0.3.2) | `0.3.2` | `Zlib OR Apache-2.0 OR MIT` |
| [objc2-quartz-core](https://crates.io/crates/objc2-quartz-core/0.3.2) | `0.3.2` | `Zlib OR Apache-2.0 OR MIT` |
| [objc2-ui-kit](https://crates.io/crates/objc2-ui-kit/0.3.2) | `0.3.2` | `Zlib OR Apache-2.0 OR MIT` |
| [objc2-user-notifications](https://crates.io/crates/objc2-user-notifications/0.3.2) | `0.3.2` | `Zlib OR Apache-2.0 OR MIT` |
| [objc2-web-kit](https://crates.io/crates/objc2-web-kit/0.3.2) | `0.3.2` | `Zlib OR Apache-2.0 OR MIT` |
| [once_cell](https://crates.io/crates/once_cell/1.21.4) | `1.21.4` | `MIT OR Apache-2.0` |
| [option-ext](https://crates.io/crates/option-ext/0.2.0) | `0.2.0` | `MPL-2.0` |
| [pango](https://crates.io/crates/pango/0.18.3) | `0.18.3` | `MIT` |
| [pango-sys](https://crates.io/crates/pango-sys/0.18.0) | `0.18.0` | `MIT` |
| [parking_lot](https://crates.io/crates/parking_lot/0.12.5) | `0.12.5` | `MIT OR Apache-2.0` |
| [parking_lot_core](https://crates.io/crates/parking_lot_core/0.9.12) | `0.9.12` | `MIT OR Apache-2.0` |
| [percent-encoding](https://crates.io/crates/percent-encoding/2.3.2) | `2.3.2` | `MIT OR Apache-2.0` |
| [phf](https://crates.io/crates/phf/0.12.1) | `0.12.1` | `MIT` |
| [phf](https://crates.io/crates/phf/0.13.1) | `0.13.1` | `MIT` |
| [phf_codegen](https://crates.io/crates/phf_codegen/0.13.1) | `0.13.1` | `MIT` |
| [phf_generator](https://crates.io/crates/phf_generator/0.13.1) | `0.13.1` | `MIT` |
| [phf_macros](https://crates.io/crates/phf_macros/0.13.1) | `0.13.1` | `MIT` |
| [phf_shared](https://crates.io/crates/phf_shared/0.12.1) | `0.12.1` | `MIT` |
| [phf_shared](https://crates.io/crates/phf_shared/0.13.1) | `0.13.1` | `MIT` |
| [pin-project-lite](https://crates.io/crates/pin-project-lite/0.2.17) | `0.2.17` | `Apache-2.0 OR MIT` |
| [pkg-config](https://crates.io/crates/pkg-config/0.3.34) | `0.3.34` | `MIT OR Apache-2.0` |
| [plist](https://crates.io/crates/plist/1.10.0) | `1.10.0` | `MIT` |
| [png](https://crates.io/crates/png/0.17.16) | `0.17.16` | `MIT OR Apache-2.0` |
| [png](https://crates.io/crates/png/0.18.1) | `0.18.1` | `MIT OR Apache-2.0` |
| [portable-atomic](https://crates.io/crates/portable-atomic/1.15.0) | `1.15.0` | `Apache-2.0 OR MIT` |
| [portable-atomic-util](https://crates.io/crates/portable-atomic-util/0.2.7) | `0.2.7` | `Apache-2.0 OR MIT` |
| [potential_utf](https://crates.io/crates/potential_utf/0.1.6) | `0.1.6` | `Unicode-3.0` |
| [powerfmt](https://crates.io/crates/powerfmt/0.2.0) | `0.2.0` | `MIT OR Apache-2.0` |
| [precomputed-hash](https://crates.io/crates/precomputed-hash/0.1.1) | `0.1.1` | `MIT` |
| [proc-macro-crate](https://crates.io/crates/proc-macro-crate/1.3.1) | `1.3.1` | `MIT OR Apache-2.0` |
| [proc-macro-crate](https://crates.io/crates/proc-macro-crate/2.0.2) | `2.0.2` | `MIT OR Apache-2.0` |
| [proc-macro-crate](https://crates.io/crates/proc-macro-crate/3.5.0) | `3.5.0` | `MIT OR Apache-2.0` |
| [proc-macro-error](https://crates.io/crates/proc-macro-error/1.0.4) | `1.0.4` | `MIT OR Apache-2.0` |
| [proc-macro-error-attr](https://crates.io/crates/proc-macro-error-attr/1.0.4) | `1.0.4` | `MIT OR Apache-2.0` |
| [proc-macro2](https://crates.io/crates/proc-macro2/1.0.107) | `1.0.107` | `MIT OR Apache-2.0` |
| [quick-xml](https://crates.io/crates/quick-xml/0.41.0) | `0.41.0` | `MIT` |
| [quote](https://crates.io/crates/quote/1.0.47) | `1.0.47` | `MIT OR Apache-2.0` |
| [r-efi](https://crates.io/crates/r-efi/5.3.0) | `5.3.0` | `MIT OR Apache-2.0 OR LGPL-2.1-or-later` |
| [r-efi](https://crates.io/crates/r-efi/6.0.0) | `6.0.0` | `MIT OR Apache-2.0 OR LGPL-2.1-or-later` |
| [raw-window-handle](https://crates.io/crates/raw-window-handle/0.6.2) | `0.6.2` | `MIT OR Apache-2.0 OR Zlib` |
| [redox_syscall](https://crates.io/crates/redox_syscall/0.5.18) | `0.5.18` | `MIT` |
| [redox_users](https://crates.io/crates/redox_users/0.5.2) | `0.5.2` | `MIT` |
| [ref-cast](https://crates.io/crates/ref-cast/1.0.27) | `1.0.27` | `MIT OR Apache-2.0` |
| [ref-cast-impl](https://crates.io/crates/ref-cast-impl/1.0.27) | `1.0.27` | `MIT OR Apache-2.0` |
| [regex](https://crates.io/crates/regex/1.13.1) | `1.13.1` | `MIT OR Apache-2.0` |
| [regex-automata](https://crates.io/crates/regex-automata/0.4.18) | `0.4.18` | `MIT OR Apache-2.0` |
| [regex-syntax](https://crates.io/crates/regex-syntax/0.8.11) | `0.8.11` | `MIT OR Apache-2.0` |
| [reqwest](https://crates.io/crates/reqwest/0.13.4) | `0.13.4` | `MIT OR Apache-2.0` |
| [rfd](https://crates.io/crates/rfd/0.16.0) | `0.16.0` | `MIT` |
| [rustc-hash](https://crates.io/crates/rustc-hash/2.1.3) | `2.1.3` | `Apache-2.0 OR MIT` |
| [rustc_version](https://crates.io/crates/rustc_version/0.4.1) | `0.4.1` | `MIT OR Apache-2.0` |
| [rustix](https://crates.io/crates/rustix/1.1.5) | `1.1.5` | `Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT` |
| [rustversion](https://crates.io/crates/rustversion/1.0.23) | `1.0.23` | `MIT OR Apache-2.0` |
| [same-file](https://crates.io/crates/same-file/1.0.6) | `1.0.6` | `Unlicense/MIT` |
| [schemars](https://crates.io/crates/schemars/0.8.22) | `0.8.22` | `MIT` |
| [schemars](https://crates.io/crates/schemars/0.9.0) | `0.9.0` | `MIT` |
| [schemars](https://crates.io/crates/schemars/1.2.2) | `1.2.2` | `MIT` |
| [schemars_derive](https://crates.io/crates/schemars_derive/0.8.22) | `0.8.22` | `MIT` |
| [scopeguard](https://crates.io/crates/scopeguard/1.2.0) | `1.2.0` | `MIT OR Apache-2.0` |
| [selectors](https://crates.io/crates/selectors/0.36.1) | `0.36.1` | `MPL-2.0` |
| [semver](https://crates.io/crates/semver/1.0.28) | `1.0.28` | `MIT OR Apache-2.0` |
| [serde](https://crates.io/crates/serde/1.0.229) | `1.0.229` | `MIT OR Apache-2.0` |
| [serde-untagged](https://crates.io/crates/serde-untagged/0.1.9) | `0.1.9` | `MIT OR Apache-2.0` |
| [serde_core](https://crates.io/crates/serde_core/1.0.229) | `1.0.229` | `MIT OR Apache-2.0` |
| [serde_derive](https://crates.io/crates/serde_derive/1.0.229) | `1.0.229` | `MIT OR Apache-2.0` |
| [serde_derive_internals](https://crates.io/crates/serde_derive_internals/0.29.1) | `0.29.1` | `MIT OR Apache-2.0` |
| [serde_json](https://crates.io/crates/serde_json/1.0.151) | `1.0.151` | `MIT OR Apache-2.0` |
| [serde_repr](https://crates.io/crates/serde_repr/0.1.21) | `0.1.21` | `MIT OR Apache-2.0` |
| [serde_spanned](https://crates.io/crates/serde_spanned/0.6.9) | `0.6.9` | `MIT OR Apache-2.0` |
| [serde_spanned](https://crates.io/crates/serde_spanned/1.1.1) | `1.1.1` | `MIT OR Apache-2.0` |
| [serde_with](https://crates.io/crates/serde_with/3.22.0) | `3.22.0` | `MIT OR Apache-2.0` |
| [serde_with_macros](https://crates.io/crates/serde_with_macros/3.22.0) | `3.22.0` | `MIT OR Apache-2.0` |
| [serialize-to-javascript](https://crates.io/crates/serialize-to-javascript/0.1.2) | `0.1.2` | `MIT OR Apache-2.0` |
| [serialize-to-javascript-impl](https://crates.io/crates/serialize-to-javascript-impl/0.1.2) | `0.1.2` | `MIT OR Apache-2.0` |
| [serialport](https://crates.io/crates/serialport/4.10.0) | `4.10.0` | `MPL-2.0` |
| [servo_arc](https://crates.io/crates/servo_arc/0.4.3) | `0.4.3` | `MIT OR Apache-2.0` |
| [sha2](https://crates.io/crates/sha2/0.10.9) | `0.10.9` | `MIT OR Apache-2.0` |
| [shlex](https://crates.io/crates/shlex/2.0.1) | `2.0.1` | `MIT OR Apache-2.0` |
| [simd-adler32](https://crates.io/crates/simd-adler32/0.3.10) | `0.3.10` | `MIT` |
| [siphasher](https://crates.io/crates/siphasher/1.0.3) | `1.0.3` | `MIT/Apache-2.0` |
| [slab](https://crates.io/crates/slab/0.4.12) | `0.4.12` | `MIT` |
| [smallvec](https://crates.io/crates/smallvec/1.15.2) | `1.15.2` | `MIT OR Apache-2.0` |
| [socket2](https://crates.io/crates/socket2/0.6.5) | `0.6.5` | `MIT OR Apache-2.0` |
| [softbuffer](https://crates.io/crates/softbuffer/0.4.8) | `0.4.8` | `MIT OR Apache-2.0` |
| [soup3](https://crates.io/crates/soup3/0.5.0) | `0.5.0` | `MIT` |
| [soup3-sys](https://crates.io/crates/soup3-sys/0.5.0) | `0.5.0` | `MIT` |
| [stable_deref_trait](https://crates.io/crates/stable_deref_trait/1.2.1) | `1.2.1` | `MIT OR Apache-2.0` |
| [string_cache](https://crates.io/crates/string_cache/0.9.0) | `0.9.0` | `MIT OR Apache-2.0` |
| [string_cache_codegen](https://crates.io/crates/string_cache_codegen/0.6.1) | `0.6.1` | `MIT OR Apache-2.0` |
| [strsim](https://crates.io/crates/strsim/0.11.1) | `0.11.1` | `MIT` |
| [swift-rs](https://crates.io/crates/swift-rs/1.0.8) | `1.0.8` | `MIT OR Apache-2.0` |
| [syn](https://crates.io/crates/syn/1.0.109) | `1.0.109` | `MIT OR Apache-2.0` |
| [syn](https://crates.io/crates/syn/2.0.119) | `2.0.119` | `MIT OR Apache-2.0` |
| [syn](https://crates.io/crates/syn/3.0.4) | `3.0.4` | `MIT OR Apache-2.0` |
| [sync_wrapper](https://crates.io/crates/sync_wrapper/1.0.2) | `1.0.2` | `Apache-2.0` |
| [synstructure](https://crates.io/crates/synstructure/0.13.2) | `0.13.2` | `MIT` |
| [system-deps](https://crates.io/crates/system-deps/6.2.2) | `6.2.2` | `MIT OR Apache-2.0` |
| [tao](https://crates.io/crates/tao/0.35.3) | `0.35.3` | `Apache-2.0` |
| [tao-macros](https://crates.io/crates/tao-macros/0.1.4) | `0.1.4` | `MIT OR Apache-2.0` |
| [target-lexicon](https://crates.io/crates/target-lexicon/0.12.16) | `0.12.16` | `Apache-2.0 WITH LLVM-exception` |
| [tauri](https://crates.io/crates/tauri/2.11.5) | `2.11.5` | `Apache-2.0 OR MIT` |
| [tauri-build](https://crates.io/crates/tauri-build/2.6.3) | `2.6.3` | `Apache-2.0 OR MIT` |
| [tauri-codegen](https://crates.io/crates/tauri-codegen/2.6.3) | `2.6.3` | `Apache-2.0 OR MIT` |
| [tauri-macros](https://crates.io/crates/tauri-macros/2.6.3) | `2.6.3` | `Apache-2.0 OR MIT` |
| [tauri-plugin](https://crates.io/crates/tauri-plugin/2.6.3) | `2.6.3` | `Apache-2.0 OR MIT` |
| [tauri-plugin-dialog](https://crates.io/crates/tauri-plugin-dialog/2.7.2) | `2.7.2` | `Apache-2.0 OR MIT` |
| [tauri-plugin-fs](https://crates.io/crates/tauri-plugin-fs/2.5.1) | `2.5.1` | `Apache-2.0 OR MIT` |
| [tauri-runtime](https://crates.io/crates/tauri-runtime/2.11.3) | `2.11.3` | `Apache-2.0 OR MIT` |
| [tauri-runtime-wry](https://crates.io/crates/tauri-runtime-wry/2.11.4) | `2.11.4` | `Apache-2.0 OR MIT` |
| [tauri-utils](https://crates.io/crates/tauri-utils/2.9.3) | `2.9.3` | `Apache-2.0 OR MIT` |
| [tauri-winres](https://crates.io/crates/tauri-winres/0.3.6) | `0.3.6` | `MIT` |
| [tempfile](https://crates.io/crates/tempfile/3.27.0) | `3.27.0` | `MIT OR Apache-2.0` |
| [tendril](https://crates.io/crates/tendril/0.5.1) | `0.5.1` | `MIT OR Apache-2.0` |
| [thiserror](https://crates.io/crates/thiserror/1.0.69) | `1.0.69` | `MIT OR Apache-2.0` |
| [thiserror](https://crates.io/crates/thiserror/2.0.20) | `2.0.20` | `MIT OR Apache-2.0` |
| [thiserror-impl](https://crates.io/crates/thiserror-impl/1.0.69) | `1.0.69` | `MIT OR Apache-2.0` |
| [thiserror-impl](https://crates.io/crates/thiserror-impl/2.0.20) | `2.0.20` | `MIT OR Apache-2.0` |
| [time](https://crates.io/crates/time/0.3.55) | `0.3.55` | `MIT OR Apache-2.0` |
| [time-core](https://crates.io/crates/time-core/0.1.9) | `0.1.9` | `MIT OR Apache-2.0` |
| [time-macros](https://crates.io/crates/time-macros/0.2.32) | `0.2.32` | `MIT OR Apache-2.0` |
| [tinystr](https://crates.io/crates/tinystr/0.8.4) | `0.8.4` | `Unicode-3.0` |
| [tinyvec](https://crates.io/crates/tinyvec/1.12.0) | `1.12.0` | `Zlib OR Apache-2.0 OR MIT` |
| [tinyvec_macros](https://crates.io/crates/tinyvec_macros/0.1.1) | `0.1.1` | `MIT OR Apache-2.0 OR Zlib` |
| [tokio](https://crates.io/crates/tokio/1.53.1) | `1.53.1` | `MIT` |
| [tokio-util](https://crates.io/crates/tokio-util/0.7.19) | `0.7.19` | `MIT` |
| [toml](https://crates.io/crates/toml/0.8.2) | `0.8.2` | `MIT OR Apache-2.0` |
| [toml](https://crates.io/crates/toml/0.9.12+spec-1.1.0) | `0.9.12+spec-1.1.0` | `MIT OR Apache-2.0` |
| [toml](https://crates.io/crates/toml/1.1.4+spec-1.1.0) | `1.1.4+spec-1.1.0` | `MIT OR Apache-2.0` |
| [toml_datetime](https://crates.io/crates/toml_datetime/0.6.3) | `0.6.3` | `MIT OR Apache-2.0` |
| [toml_datetime](https://crates.io/crates/toml_datetime/0.7.5+spec-1.1.0) | `0.7.5+spec-1.1.0` | `MIT OR Apache-2.0` |
| [toml_datetime](https://crates.io/crates/toml_datetime/1.1.1+spec-1.1.0) | `1.1.1+spec-1.1.0` | `MIT OR Apache-2.0` |
| [toml_edit](https://crates.io/crates/toml_edit/0.19.15) | `0.19.15` | `MIT OR Apache-2.0` |
| [toml_edit](https://crates.io/crates/toml_edit/0.20.2) | `0.20.2` | `MIT OR Apache-2.0` |
| [toml_edit](https://crates.io/crates/toml_edit/0.25.13+spec-1.1.0) | `0.25.13+spec-1.1.0` | `MIT OR Apache-2.0` |
| [toml_parser](https://crates.io/crates/toml_parser/1.1.3+spec-1.1.0) | `1.1.3+spec-1.1.0` | `MIT OR Apache-2.0` |
| [toml_writer](https://crates.io/crates/toml_writer/1.1.2+spec-1.1.0) | `1.1.2+spec-1.1.0` | `MIT OR Apache-2.0` |
| [tower](https://crates.io/crates/tower/0.5.3) | `0.5.3` | `MIT` |
| [tower-http](https://crates.io/crates/tower-http/0.6.11) | `0.6.11` | `MIT` |
| [tower-layer](https://crates.io/crates/tower-layer/0.3.3) | `0.3.3` | `MIT` |
| [tower-service](https://crates.io/crates/tower-service/0.3.3) | `0.3.3` | `MIT` |
| [tracing](https://crates.io/crates/tracing/0.1.44) | `0.1.44` | `MIT` |
| [tracing-core](https://crates.io/crates/tracing-core/0.1.36) | `0.1.36` | `MIT` |
| [tray-icon](https://crates.io/crates/tray-icon/0.24.2) | `0.24.2` | `MIT OR Apache-2.0` |
| [try-lock](https://crates.io/crates/try-lock/0.2.5) | `0.2.5` | `MIT` |
| [typeid](https://crates.io/crates/typeid/1.0.3) | `1.0.3` | `MIT OR Apache-2.0` |
| [typenum](https://crates.io/crates/typenum/1.20.1) | `1.20.1` | `MIT OR Apache-2.0` |
| [unescaper](https://crates.io/crates/unescaper/0.1.10) | `0.1.10` | `MIT OR GPL-3.0-only` |
| [unic-char-property](https://crates.io/crates/unic-char-property/0.9.0) | `0.9.0` | `MIT/Apache-2.0` |
| [unic-char-range](https://crates.io/crates/unic-char-range/0.9.0) | `0.9.0` | `MIT/Apache-2.0` |
| [unic-common](https://crates.io/crates/unic-common/0.9.0) | `0.9.0` | `MIT/Apache-2.0` |
| [unic-ucd-ident](https://crates.io/crates/unic-ucd-ident/0.9.0) | `0.9.0` | `MIT/Apache-2.0` |
| [unic-ucd-version](https://crates.io/crates/unic-ucd-version/0.9.0) | `0.9.0` | `MIT/Apache-2.0` |
| [unicode-ident](https://crates.io/crates/unicode-ident/1.0.24) | `1.0.24` | `(MIT OR Apache-2.0) AND Unicode-3.0` |
| [unicode-segmentation](https://crates.io/crates/unicode-segmentation/1.13.3) | `1.13.3` | `MIT OR Apache-2.0` |
| [url](https://crates.io/crates/url/2.5.8) | `2.5.8` | `MIT OR Apache-2.0` |
| [urlpattern](https://crates.io/crates/urlpattern/0.3.0) | `0.3.0` | `MIT` |
| [utf8_iter](https://crates.io/crates/utf8_iter/1.0.4) | `1.0.4` | `Apache-2.0 OR MIT` |
| [uuid](https://crates.io/crates/uuid/1.26.0) | `1.26.0` | `Apache-2.0 OR MIT` |
| [version-compare](https://crates.io/crates/version-compare/0.2.1) | `0.2.1` | `MIT` |
| [version_check](https://crates.io/crates/version_check/0.9.5) | `0.9.5` | `MIT/Apache-2.0` |
| [vswhom](https://crates.io/crates/vswhom/0.1.0) | `0.1.0` | `MIT` |
| [vswhom-sys](https://crates.io/crates/vswhom-sys/0.1.3) | `0.1.3` | `MIT` |
| [walkdir](https://crates.io/crates/walkdir/2.5.0) | `2.5.0` | `Unlicense/MIT` |
| [want](https://crates.io/crates/want/0.3.1) | `0.3.1` | `MIT` |
| [wasi](https://crates.io/crates/wasi/0.11.1+wasi-snapshot-preview1) | `0.11.1+wasi-snapshot-preview1` | `Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT` |
| [wasip2](https://crates.io/crates/wasip2/1.0.4+wasi-0.2.12) | `1.0.4+wasi-0.2.12` | `Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT` |
| [wasm-bindgen](https://crates.io/crates/wasm-bindgen/0.2.127) | `0.2.127` | `MIT OR Apache-2.0` |
| [wasm-bindgen-futures](https://crates.io/crates/wasm-bindgen-futures/0.4.77) | `0.4.77` | `MIT OR Apache-2.0` |
| [wasm-bindgen-macro](https://crates.io/crates/wasm-bindgen-macro/0.2.127) | `0.2.127` | `MIT OR Apache-2.0` |
| [wasm-bindgen-macro-support](https://crates.io/crates/wasm-bindgen-macro-support/0.2.127) | `0.2.127` | `MIT OR Apache-2.0` |
| [wasm-bindgen-shared](https://crates.io/crates/wasm-bindgen-shared/0.2.127) | `0.2.127` | `MIT OR Apache-2.0` |
| [wasm-streams](https://crates.io/crates/wasm-streams/0.5.0) | `0.5.0` | `MIT OR Apache-2.0` |
| [web-sys](https://crates.io/crates/web-sys/0.3.104) | `0.3.104` | `MIT OR Apache-2.0` |
| [web_atoms](https://crates.io/crates/web_atoms/0.2.6) | `0.2.6` | `MIT OR Apache-2.0` |
| [webkit2gtk](https://crates.io/crates/webkit2gtk/2.0.2) | `2.0.2` | `MIT` |
| [webkit2gtk-sys](https://crates.io/crates/webkit2gtk-sys/2.0.2) | `2.0.2` | `MIT` |
| [webview2-com](https://crates.io/crates/webview2-com/0.38.2) | `0.38.2` | `MIT` |
| [webview2-com-macros](https://crates.io/crates/webview2-com-macros/0.8.1) | `0.8.1` | `MIT` |
| [webview2-com-sys](https://crates.io/crates/webview2-com-sys/0.38.2) | `0.38.2` | `MIT` |
| [winapi](https://crates.io/crates/winapi/0.3.9) | `0.3.9` | `MIT/Apache-2.0` |
| [winapi-i686-pc-windows-gnu](https://crates.io/crates/winapi-i686-pc-windows-gnu/0.4.0) | `0.4.0` | `MIT/Apache-2.0` |
| [winapi-util](https://crates.io/crates/winapi-util/0.1.11) | `0.1.11` | `Unlicense OR MIT` |
| [winapi-x86_64-pc-windows-gnu](https://crates.io/crates/winapi-x86_64-pc-windows-gnu/0.4.0) | `0.4.0` | `MIT/Apache-2.0` |
| [window-vibrancy](https://crates.io/crates/window-vibrancy/0.6.0) | `0.6.0` | `Apache-2.0 OR MIT` |
| [windows](https://crates.io/crates/windows/0.61.3) | `0.61.3` | `MIT OR Apache-2.0` |
| [windows-collections](https://crates.io/crates/windows-collections/0.2.0) | `0.2.0` | `MIT OR Apache-2.0` |
| [windows-core](https://crates.io/crates/windows-core/0.61.2) | `0.61.2` | `MIT OR Apache-2.0` |
| [windows-core](https://crates.io/crates/windows-core/0.62.2) | `0.62.2` | `MIT OR Apache-2.0` |
| [windows-future](https://crates.io/crates/windows-future/0.2.1) | `0.2.1` | `MIT OR Apache-2.0` |
| [windows-implement](https://crates.io/crates/windows-implement/0.60.2) | `0.60.2` | `MIT OR Apache-2.0` |
| [windows-interface](https://crates.io/crates/windows-interface/0.59.3) | `0.59.3` | `MIT OR Apache-2.0` |
| [windows-link](https://crates.io/crates/windows-link/0.1.3) | `0.1.3` | `MIT OR Apache-2.0` |
| [windows-link](https://crates.io/crates/windows-link/0.2.1) | `0.2.1` | `MIT OR Apache-2.0` |
| [windows-numerics](https://crates.io/crates/windows-numerics/0.2.0) | `0.2.0` | `MIT OR Apache-2.0` |
| [windows-result](https://crates.io/crates/windows-result/0.3.4) | `0.3.4` | `MIT OR Apache-2.0` |
| [windows-result](https://crates.io/crates/windows-result/0.4.1) | `0.4.1` | `MIT OR Apache-2.0` |
| [windows-strings](https://crates.io/crates/windows-strings/0.4.2) | `0.4.2` | `MIT OR Apache-2.0` |
| [windows-strings](https://crates.io/crates/windows-strings/0.5.1) | `0.5.1` | `MIT OR Apache-2.0` |
| [windows-sys](https://crates.io/crates/windows-sys/0.45.0) | `0.45.0` | `MIT OR Apache-2.0` |
| [windows-sys](https://crates.io/crates/windows-sys/0.52.0) | `0.52.0` | `MIT OR Apache-2.0` |
| [windows-sys](https://crates.io/crates/windows-sys/0.59.0) | `0.59.0` | `MIT OR Apache-2.0` |
| [windows-sys](https://crates.io/crates/windows-sys/0.60.2) | `0.60.2` | `MIT OR Apache-2.0` |
| [windows-sys](https://crates.io/crates/windows-sys/0.61.2) | `0.61.2` | `MIT OR Apache-2.0` |
| [windows-targets](https://crates.io/crates/windows-targets/0.42.2) | `0.42.2` | `MIT OR Apache-2.0` |
| [windows-targets](https://crates.io/crates/windows-targets/0.52.6) | `0.52.6` | `MIT OR Apache-2.0` |
| [windows-targets](https://crates.io/crates/windows-targets/0.53.5) | `0.53.5` | `MIT OR Apache-2.0` |
| [windows-threading](https://crates.io/crates/windows-threading/0.1.0) | `0.1.0` | `MIT OR Apache-2.0` |
| [windows-version](https://crates.io/crates/windows-version/0.1.7) | `0.1.7` | `MIT OR Apache-2.0` |
| [windows_aarch64_gnullvm](https://crates.io/crates/windows_aarch64_gnullvm/0.42.2) | `0.42.2` | `MIT OR Apache-2.0` |
| [windows_aarch64_gnullvm](https://crates.io/crates/windows_aarch64_gnullvm/0.52.6) | `0.52.6` | `MIT OR Apache-2.0` |
| [windows_aarch64_gnullvm](https://crates.io/crates/windows_aarch64_gnullvm/0.53.1) | `0.53.1` | `MIT OR Apache-2.0` |
| [windows_aarch64_msvc](https://crates.io/crates/windows_aarch64_msvc/0.42.2) | `0.42.2` | `MIT OR Apache-2.0` |
| [windows_aarch64_msvc](https://crates.io/crates/windows_aarch64_msvc/0.52.6) | `0.52.6` | `MIT OR Apache-2.0` |
| [windows_aarch64_msvc](https://crates.io/crates/windows_aarch64_msvc/0.53.1) | `0.53.1` | `MIT OR Apache-2.0` |
| [windows_i686_gnu](https://crates.io/crates/windows_i686_gnu/0.42.2) | `0.42.2` | `MIT OR Apache-2.0` |
| [windows_i686_gnu](https://crates.io/crates/windows_i686_gnu/0.52.6) | `0.52.6` | `MIT OR Apache-2.0` |
| [windows_i686_gnu](https://crates.io/crates/windows_i686_gnu/0.53.1) | `0.53.1` | `MIT OR Apache-2.0` |
| [windows_i686_gnullvm](https://crates.io/crates/windows_i686_gnullvm/0.52.6) | `0.52.6` | `MIT OR Apache-2.0` |
| [windows_i686_gnullvm](https://crates.io/crates/windows_i686_gnullvm/0.53.1) | `0.53.1` | `MIT OR Apache-2.0` |
| [windows_i686_msvc](https://crates.io/crates/windows_i686_msvc/0.42.2) | `0.42.2` | `MIT OR Apache-2.0` |
| [windows_i686_msvc](https://crates.io/crates/windows_i686_msvc/0.52.6) | `0.52.6` | `MIT OR Apache-2.0` |
| [windows_i686_msvc](https://crates.io/crates/windows_i686_msvc/0.53.1) | `0.53.1` | `MIT OR Apache-2.0` |
| [windows_x86_64_gnu](https://crates.io/crates/windows_x86_64_gnu/0.42.2) | `0.42.2` | `MIT OR Apache-2.0` |
| [windows_x86_64_gnu](https://crates.io/crates/windows_x86_64_gnu/0.52.6) | `0.52.6` | `MIT OR Apache-2.0` |
| [windows_x86_64_gnu](https://crates.io/crates/windows_x86_64_gnu/0.53.1) | `0.53.1` | `MIT OR Apache-2.0` |
| [windows_x86_64_gnullvm](https://crates.io/crates/windows_x86_64_gnullvm/0.42.2) | `0.42.2` | `MIT OR Apache-2.0` |
| [windows_x86_64_gnullvm](https://crates.io/crates/windows_x86_64_gnullvm/0.52.6) | `0.52.6` | `MIT OR Apache-2.0` |
| [windows_x86_64_gnullvm](https://crates.io/crates/windows_x86_64_gnullvm/0.53.1) | `0.53.1` | `MIT OR Apache-2.0` |
| [windows_x86_64_msvc](https://crates.io/crates/windows_x86_64_msvc/0.42.2) | `0.42.2` | `MIT OR Apache-2.0` |
| [windows_x86_64_msvc](https://crates.io/crates/windows_x86_64_msvc/0.52.6) | `0.52.6` | `MIT OR Apache-2.0` |
| [windows_x86_64_msvc](https://crates.io/crates/windows_x86_64_msvc/0.53.1) | `0.53.1` | `MIT OR Apache-2.0` |
| [winnow](https://crates.io/crates/winnow/0.5.40) | `0.5.40` | `MIT` |
| [winnow](https://crates.io/crates/winnow/0.7.15) | `0.7.15` | `MIT` |
| [winnow](https://crates.io/crates/winnow/1.0.4) | `1.0.4` | `MIT` |
| [winreg](https://crates.io/crates/winreg/0.55.0) | `0.55.0` | `MIT` |
| [wit-bindgen](https://crates.io/crates/wit-bindgen/0.57.1) | `0.57.1` | `Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT` |
| [writeable](https://crates.io/crates/writeable/0.6.4) | `0.6.4` | `Unicode-3.0` |
| [wry](https://crates.io/crates/wry/0.55.1) | `0.55.1` | `Apache-2.0 OR MIT` |
| [x11](https://crates.io/crates/x11/2.21.0) | `2.21.0` | `MIT` |
| [x11-dl](https://crates.io/crates/x11-dl/2.21.0) | `2.21.0` | `MIT` |
| [yoke](https://crates.io/crates/yoke/0.8.3) | `0.8.3` | `Unicode-3.0` |
| [yoke-derive](https://crates.io/crates/yoke-derive/0.8.2) | `0.8.2` | `Unicode-3.0` |
| [zerofrom](https://crates.io/crates/zerofrom/0.1.8) | `0.1.8` | `Unicode-3.0` |
| [zerofrom-derive](https://crates.io/crates/zerofrom-derive/0.1.7) | `0.1.7` | `Unicode-3.0` |
| [zerotrie](https://crates.io/crates/zerotrie/0.2.5) | `0.2.5` | `Unicode-3.0` |
| [zerovec](https://crates.io/crates/zerovec/0.11.8) | `0.11.8` | `Unicode-3.0` |
| [zerovec-derive](https://crates.io/crates/zerovec-derive/0.11.6) | `0.11.6` | `Unicode-3.0` |
| [zlib-rs](https://crates.io/crates/zlib-rs/0.6.7) | `0.6.7` | `Zlib` |
| [zmij](https://crates.io/crates/zmij/1.0.23) | `1.0.23` | `MIT` |

## npm packages

124 locked package entries; 8 distinct declared license expressions.

| Package | Version | Declared license expression | Lockfile scope |
| --- | --- | --- | --- |
| [@oxc-project/types](https://www.npmjs.com/package/@oxc-project/types) | `0.147.0` | `MIT` | development/build |
| [@reduxjs/toolkit](https://www.npmjs.com/package/@reduxjs/toolkit) | `2.12.0` | `MIT` | production |
| [@rolldown/binding-android-arm-eabi](https://www.npmjs.com/package/@rolldown/binding-android-arm-eabi) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-android-arm64](https://www.npmjs.com/package/@rolldown/binding-android-arm64) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-darwin-arm64](https://www.npmjs.com/package/@rolldown/binding-darwin-arm64) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-darwin-x64](https://www.npmjs.com/package/@rolldown/binding-darwin-x64) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-freebsd-x64](https://www.npmjs.com/package/@rolldown/binding-freebsd-x64) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-linux-arm-gnueabihf](https://www.npmjs.com/package/@rolldown/binding-linux-arm-gnueabihf) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-linux-arm64-gnu](https://www.npmjs.com/package/@rolldown/binding-linux-arm64-gnu) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-linux-arm64-musl](https://www.npmjs.com/package/@rolldown/binding-linux-arm64-musl) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-linux-ppc64-gnu](https://www.npmjs.com/package/@rolldown/binding-linux-ppc64-gnu) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-linux-s390x-gnu](https://www.npmjs.com/package/@rolldown/binding-linux-s390x-gnu) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-linux-x64-gnu](https://www.npmjs.com/package/@rolldown/binding-linux-x64-gnu) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-linux-x64-musl](https://www.npmjs.com/package/@rolldown/binding-linux-x64-musl) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-openharmony-arm64](https://www.npmjs.com/package/@rolldown/binding-openharmony-arm64) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-win32-arm64-msvc](https://www.npmjs.com/package/@rolldown/binding-win32-arm64-msvc) | `1.2.6` | `MIT` | development/build |
| [@rolldown/binding-win32-x64-msvc](https://www.npmjs.com/package/@rolldown/binding-win32-x64-msvc) | `1.2.6` | `MIT` | development/build |
| [@rolldown/pluginutils](https://www.npmjs.com/package/@rolldown/pluginutils) | `1.0.1` | `MIT` | development/build |
| [@standard-schema/spec](https://www.npmjs.com/package/@standard-schema/spec) | `1.1.0` | `MIT` | production |
| [@standard-schema/utils](https://www.npmjs.com/package/@standard-schema/utils) | `0.3.0` | `MIT` | production |
| [@tauri-apps/api](https://www.npmjs.com/package/@tauri-apps/api) | `2.11.1` | `Apache-2.0 OR MIT` | production |
| [@tauri-apps/cli](https://www.npmjs.com/package/@tauri-apps/cli) | `2.11.4` | `Apache-2.0 OR MIT` | development/build |
| [@tauri-apps/cli-darwin-arm64](https://www.npmjs.com/package/@tauri-apps/cli-darwin-arm64) | `2.11.4` | `Apache-2.0 OR MIT` | development/build |
| [@tauri-apps/cli-darwin-x64](https://www.npmjs.com/package/@tauri-apps/cli-darwin-x64) | `2.11.4` | `Apache-2.0 OR MIT` | development/build |
| [@tauri-apps/cli-linux-arm-gnueabihf](https://www.npmjs.com/package/@tauri-apps/cli-linux-arm-gnueabihf) | `2.11.4` | `Apache-2.0 OR MIT` | development/build |
| [@tauri-apps/cli-linux-arm64-gnu](https://www.npmjs.com/package/@tauri-apps/cli-linux-arm64-gnu) | `2.11.4` | `Apache-2.0 OR MIT` | development/build |
| [@tauri-apps/cli-linux-arm64-musl](https://www.npmjs.com/package/@tauri-apps/cli-linux-arm64-musl) | `2.11.4` | `Apache-2.0 OR MIT` | development/build |
| [@tauri-apps/cli-linux-riscv64-gnu](https://www.npmjs.com/package/@tauri-apps/cli-linux-riscv64-gnu) | `2.11.4` | `Apache-2.0 OR MIT` | development/build |
| [@tauri-apps/cli-linux-x64-gnu](https://www.npmjs.com/package/@tauri-apps/cli-linux-x64-gnu) | `2.11.4` | `Apache-2.0 OR MIT` | development/build |
| [@tauri-apps/cli-linux-x64-musl](https://www.npmjs.com/package/@tauri-apps/cli-linux-x64-musl) | `2.11.4` | `Apache-2.0 OR MIT` | development/build |
| [@tauri-apps/cli-win32-arm64-msvc](https://www.npmjs.com/package/@tauri-apps/cli-win32-arm64-msvc) | `2.11.4` | `Apache-2.0 OR MIT` | development/build |
| [@tauri-apps/cli-win32-ia32-msvc](https://www.npmjs.com/package/@tauri-apps/cli-win32-ia32-msvc) | `2.11.4` | `Apache-2.0 OR MIT` | development/build |
| [@tauri-apps/cli-win32-x64-msvc](https://www.npmjs.com/package/@tauri-apps/cli-win32-x64-msvc) | `2.11.4` | `Apache-2.0 OR MIT` | development/build |
| [@tauri-apps/plugin-dialog](https://www.npmjs.com/package/@tauri-apps/plugin-dialog) | `2.7.2` | `MIT OR Apache-2.0` | production |
| [@types/d3-array](https://www.npmjs.com/package/@types/d3-array) | `3.2.2` | `MIT` | production |
| [@types/d3-color](https://www.npmjs.com/package/@types/d3-color) | `3.1.3` | `MIT` | production |
| [@types/d3-ease](https://www.npmjs.com/package/@types/d3-ease) | `3.0.2` | `MIT` | production |
| [@types/d3-interpolate](https://www.npmjs.com/package/@types/d3-interpolate) | `3.0.4` | `MIT` | production |
| [@types/d3-path](https://www.npmjs.com/package/@types/d3-path) | `3.1.1` | `MIT` | production |
| [@types/d3-scale](https://www.npmjs.com/package/@types/d3-scale) | `4.0.9` | `MIT` | production |
| [@types/d3-shape](https://www.npmjs.com/package/@types/d3-shape) | `3.2.0` | `MIT` | production |
| [@types/d3-time](https://www.npmjs.com/package/@types/d3-time) | `3.0.4` | `MIT` | production |
| [@types/d3-timer](https://www.npmjs.com/package/@types/d3-timer) | `3.0.2` | `MIT` | production |
| [@types/node](https://www.npmjs.com/package/@types/node) | `26.4.0` | `MIT` | development/build |
| [@types/react](https://www.npmjs.com/package/@types/react) | `19.2.18` | `MIT` | production |
| [@types/react-dom](https://www.npmjs.com/package/@types/react-dom) | `19.2.5` | `MIT` | development/build |
| [@types/use-sync-external-store](https://www.npmjs.com/package/@types/use-sync-external-store) | `0.0.6` | `MIT` | production |
| [@typescript/typescript-aix-ppc64](https://www.npmjs.com/package/@typescript/typescript-aix-ppc64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-darwin-arm64](https://www.npmjs.com/package/@typescript/typescript-darwin-arm64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-darwin-x64](https://www.npmjs.com/package/@typescript/typescript-darwin-x64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-freebsd-arm64](https://www.npmjs.com/package/@typescript/typescript-freebsd-arm64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-freebsd-x64](https://www.npmjs.com/package/@typescript/typescript-freebsd-x64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-linux-arm](https://www.npmjs.com/package/@typescript/typescript-linux-arm) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-linux-arm64](https://www.npmjs.com/package/@typescript/typescript-linux-arm64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-linux-loong64](https://www.npmjs.com/package/@typescript/typescript-linux-loong64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-linux-mips64el](https://www.npmjs.com/package/@typescript/typescript-linux-mips64el) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-linux-ppc64](https://www.npmjs.com/package/@typescript/typescript-linux-ppc64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-linux-riscv64](https://www.npmjs.com/package/@typescript/typescript-linux-riscv64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-linux-s390x](https://www.npmjs.com/package/@typescript/typescript-linux-s390x) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-linux-x64](https://www.npmjs.com/package/@typescript/typescript-linux-x64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-netbsd-arm64](https://www.npmjs.com/package/@typescript/typescript-netbsd-arm64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-netbsd-x64](https://www.npmjs.com/package/@typescript/typescript-netbsd-x64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-openbsd-arm64](https://www.npmjs.com/package/@typescript/typescript-openbsd-arm64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-openbsd-x64](https://www.npmjs.com/package/@typescript/typescript-openbsd-x64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-sunos-x64](https://www.npmjs.com/package/@typescript/typescript-sunos-x64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-win32-arm64](https://www.npmjs.com/package/@typescript/typescript-win32-arm64) | `7.0.2` | `Apache-2.0` | development/build |
| [@typescript/typescript-win32-x64](https://www.npmjs.com/package/@typescript/typescript-win32-x64) | `7.0.2` | `Apache-2.0` | development/build |
| [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) | `6.1.1` | `MIT` | development/build |
| [clsx](https://www.npmjs.com/package/clsx) | `2.1.1` | `MIT` | production |
| [csstype](https://www.npmjs.com/package/csstype) | `3.2.3` | `MIT` | production |
| [d3-array](https://www.npmjs.com/package/d3-array) | `3.2.4` | `ISC` | production |
| [d3-color](https://www.npmjs.com/package/d3-color) | `3.1.0` | `ISC` | production |
| [d3-ease](https://www.npmjs.com/package/d3-ease) | `3.0.1` | `BSD-3-Clause` | production |
| [d3-format](https://www.npmjs.com/package/d3-format) | `3.1.2` | `ISC` | production |
| [d3-interpolate](https://www.npmjs.com/package/d3-interpolate) | `3.0.1` | `ISC` | production |
| [d3-path](https://www.npmjs.com/package/d3-path) | `3.1.0` | `ISC` | production |
| [d3-scale](https://www.npmjs.com/package/d3-scale) | `4.0.2` | `ISC` | production |
| [d3-shape](https://www.npmjs.com/package/d3-shape) | `3.2.0` | `ISC` | production |
| [d3-time](https://www.npmjs.com/package/d3-time) | `3.1.0` | `ISC` | production |
| [d3-time-format](https://www.npmjs.com/package/d3-time-format) | `4.1.0` | `ISC` | production |
| [d3-timer](https://www.npmjs.com/package/d3-timer) | `3.0.1` | `ISC` | production |
| [decimal.js-light](https://www.npmjs.com/package/decimal.js-light) | `2.5.1` | `MIT` | production |
| [detect-libc](https://www.npmjs.com/package/detect-libc) | `2.1.2` | `Apache-2.0` | development/build |
| [es-toolkit](https://www.npmjs.com/package/es-toolkit) | `1.52.0` | `MIT` | production |
| [eventemitter3](https://www.npmjs.com/package/eventemitter3) | `5.0.4` | `MIT` | production |
| [fdir](https://www.npmjs.com/package/fdir) | `6.5.0` | `MIT` | development/build |
| [fsevents](https://www.npmjs.com/package/fsevents) | `2.3.3` | `MIT` | development/build |
| [immer](https://www.npmjs.com/package/immer) | `11.1.18` | `MIT` | production |
| [internmap](https://www.npmjs.com/package/internmap) | `2.0.3` | `ISC` | production |
| [lightningcss](https://www.npmjs.com/package/lightningcss) | `1.33.0` | `MPL-2.0` | development/build |
| [lightningcss-android-arm64](https://www.npmjs.com/package/lightningcss-android-arm64) | `1.33.0` | `MPL-2.0` | development/build |
| [lightningcss-darwin-arm64](https://www.npmjs.com/package/lightningcss-darwin-arm64) | `1.33.0` | `MPL-2.0` | development/build |
| [lightningcss-darwin-x64](https://www.npmjs.com/package/lightningcss-darwin-x64) | `1.33.0` | `MPL-2.0` | development/build |
| [lightningcss-freebsd-x64](https://www.npmjs.com/package/lightningcss-freebsd-x64) | `1.33.0` | `MPL-2.0` | development/build |
| [lightningcss-linux-arm-gnueabihf](https://www.npmjs.com/package/lightningcss-linux-arm-gnueabihf) | `1.33.0` | `MPL-2.0` | development/build |
| [lightningcss-linux-arm64-gnu](https://www.npmjs.com/package/lightningcss-linux-arm64-gnu) | `1.33.0` | `MPL-2.0` | development/build |
| [lightningcss-linux-arm64-musl](https://www.npmjs.com/package/lightningcss-linux-arm64-musl) | `1.33.0` | `MPL-2.0` | development/build |
| [lightningcss-linux-x64-gnu](https://www.npmjs.com/package/lightningcss-linux-x64-gnu) | `1.33.0` | `MPL-2.0` | development/build |
| [lightningcss-linux-x64-musl](https://www.npmjs.com/package/lightningcss-linux-x64-musl) | `1.33.0` | `MPL-2.0` | development/build |
| [lightningcss-win32-arm64-msvc](https://www.npmjs.com/package/lightningcss-win32-arm64-msvc) | `1.33.0` | `MPL-2.0` | development/build |
| [lightningcss-win32-x64-msvc](https://www.npmjs.com/package/lightningcss-win32-x64-msvc) | `1.33.0` | `MPL-2.0` | development/build |
| [lucide-react](https://www.npmjs.com/package/lucide-react) | `1.35.0` | `ISC` | production |
| [nanoid](https://www.npmjs.com/package/nanoid) | `3.3.18` | `MIT` | development/build |
| [picocolors](https://www.npmjs.com/package/picocolors) | `1.1.1` | `ISC` | development/build |
| [picomatch](https://www.npmjs.com/package/picomatch) | `4.0.7` | `MIT` | development/build |
| [postcss](https://www.npmjs.com/package/postcss) | `8.5.26` | `MIT` | development/build |
| [react](https://www.npmjs.com/package/react) | `19.2.8` | `MIT` | production |
| [react-dom](https://www.npmjs.com/package/react-dom) | `19.2.8` | `MIT` | production |
| [react-is](https://www.npmjs.com/package/react-is) | `19.2.8` | `MIT` | production |
| [react-redux](https://www.npmjs.com/package/react-redux) | `9.3.0` | `MIT` | production |
| [recharts](https://www.npmjs.com/package/recharts) | `3.10.1` | `MIT` | production |
| [redux](https://www.npmjs.com/package/redux) | `5.0.1` | `MIT` | production |
| [redux-thunk](https://www.npmjs.com/package/redux-thunk) | `3.1.0` | `MIT` | production |
| [reselect](https://www.npmjs.com/package/reselect) | `5.2.0` | `MIT` | production |
| [rolldown](https://www.npmjs.com/package/rolldown) | `1.2.6` | `MIT` | development/build |
| [scheduler](https://www.npmjs.com/package/scheduler) | `0.27.0` | `MIT` | production |
| [source-map-js](https://www.npmjs.com/package/source-map-js) | `1.2.1` | `BSD-3-Clause` | development/build |
| [tiny-invariant](https://www.npmjs.com/package/tiny-invariant) | `1.3.3` | `MIT` | production |
| [tinyglobby](https://www.npmjs.com/package/tinyglobby) | `0.2.17` | `MIT` | development/build |
| [typescript](https://www.npmjs.com/package/typescript) | `7.0.2` | `Apache-2.0` | development/build |
| [undici-types](https://www.npmjs.com/package/undici-types) | `8.3.0` | `MIT` | development/build |
| [use-sync-external-store](https://www.npmjs.com/package/use-sync-external-store) | `1.6.0` | `MIT` | production |
| [victory-vendor](https://www.npmjs.com/package/victory-vendor) | `37.3.6` | `MIT AND ISC` | production |
| [vite](https://www.npmjs.com/package/vite) | `8.2.2` | `MIT` | development/build |

## License expression counts

Counts reflect package records in the lockfiles, not files shipped in a particular platform build.

| Ecosystem | Declared expression | Package records |
| --- | --- | --- |
| Cargo | `(MIT OR Apache-2.0) AND Unicode-3.0` | 1 |
| Cargo | `0BSD OR MIT OR Apache-2.0` | 1 |
| Cargo | `Apache-2.0` | 2 |
| Cargo | `Apache-2.0 / MIT` | 1 |
| Cargo | `Apache-2.0 AND MIT` | 1 |
| Cargo | `Apache-2.0 OR MIT` | 35 |
| Cargo | `Apache-2.0 WITH LLVM-exception` | 1 |
| Cargo | `Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT` | 5 |
| Cargo | `Apache-2.0/MIT` | 3 |
| Cargo | `BSD-2-Clause OR MIT OR Apache-2.0` | 1 |
| Cargo | `BSD-3-Clause` | 2 |
| Cargo | `BSD-3-Clause AND MIT` | 1 |
| Cargo | `BSD-3-Clause OR MIT OR Apache-2.0` | 2 |
| Cargo | `BSD-3-Clause/MIT` | 1 |
| Cargo | `CC0-1.0 OR MIT-0 OR Apache-2.0` | 1 |
| Cargo | `ISC` | 1 |
| Cargo | `MIT` | 103 |
| Cargo | `MIT / Apache-2.0` | 1 |
| Cargo | `MIT OR Apache-2.0` | 215 |
| Cargo | `MIT OR Apache-2.0 OR LGPL-2.1-or-later` | 2 |
| Cargo | `MIT OR Apache-2.0 OR Zlib` | 2 |
| Cargo | `MIT OR GPL-3.0-only` | 1 |
| Cargo | `MIT OR Zlib OR Apache-2.0` | 2 |
| Cargo | `MIT/Apache-2.0` | 18 |
| Cargo | `MPL-2.0` | 6 |
| Cargo | `Unicode-3.0` | 18 |
| Cargo | `Unlicense OR MIT` | 9 |
| Cargo | `Unlicense/MIT` | 2 |
| Cargo | `Zlib` | 2 |
| Cargo | `Zlib OR Apache-2.0 OR MIT` | 17 |
| npm | `Apache-2.0` | 22 |
| npm | `Apache-2.0 OR MIT` | 13 |
| npm | `BSD-3-Clause` | 2 |
| npm | `ISC` | 13 |
| npm | `MIT` | 60 |
| npm | `MIT AND ISC` | 1 |
| npm | `MIT OR Apache-2.0` | 1 |
| npm | `MPL-2.0` | 12 |
