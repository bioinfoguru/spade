# SPADE website

The public website is a small Vue/Vite site in this folder. GitHub Pages builds and deploys it through `.github/workflows/pages.yml`.

## Run locally

From the project root:

```sh
pnpm install
pnpm run website:dev
```

Create a production build with `pnpm run website:build`.

## GitHub Pages setup

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. Set the custom domain to `spade.bioinfo.guru`. The `public/CNAME` file is copied into the deployed site.

Create a DNS CNAME record for `spade.bioinfo.guru` pointing to `bioinfoguru.github.io` at the DNS provider. GitHub must also have the custom domain configured in repository Pages settings; the CNAME file alone does not configure that setting.

The download buttons look up the latest GitHub Release at runtime and link directly to matching release assets. The contact form currently opens the visitor's mail app; connect Maileroo after its credentials and preferred sending setup are provided.
