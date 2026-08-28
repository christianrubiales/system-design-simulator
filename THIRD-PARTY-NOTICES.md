# Third-Party Notices

## AWS Architecture Icons — `public/aws-icons/`

The SVG files in `public/aws-icons/` are the official AWS Architecture Icons,
© Amazon Web Services, Inc. or its affiliates. They are **not** covered by this
repository's MIT license and are explicitly excluded from its grant.

- **License:** CC-BY-ND 2.0 (Attribution-NoDerivatives) —
  <https://creativecommons.org/licenses/by-nd/2.0/>
- **Source:** <https://aws.amazon.com/architecture/icons/>
- **Package version:** `07312026`

The icons are redistributed **unmodified**, as the NoDerivatives term requires.
`scripts/fetch-aws-icons.ts` copies them byte-for-byte and renames the files
only; it performs no minification, metadata stripping, or recoloring. In the
application the icons are rendered inside a neutral container — the icon artwork
itself is never recolored, re-proportioned, or otherwise altered.

Only AWS **architecture service icons** are used. No AWS logo or wordmark
appears in this project.

SystemForge is not affiliated with, endorsed by, or sponsored by Amazon Web
Services. Use of AWS service names and icons is descriptive, to identify the
services a user is modeling in a system design.

This dual-license arrangement follows AWS's own
<https://github.com/awslabs/aws-icons-for-plantuml>, which distributes these
icons under CC-BY-ND 2.0 alongside MIT-licensed code.

---

All other files in this repository are MIT licensed. See `LICENSE`.
