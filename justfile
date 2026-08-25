default: build

install:
    npm ci

build: install
    npx tsc --noEmit
    node build.mjs

# Serve dist/ locally. Service worker + PWA install need http://, not file://
serve: build
    cd dist && python3 -m http.server 4173

# Deployment is automatic: push to main and .github/workflows/deploy.yml
# publishes dist/ to GitHub Pages.

clean:
    rm -rf dist node_modules
