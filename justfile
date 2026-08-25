default: build

install:
    npm install

build: install
    npx tsc --noEmit
    node build.mjs

# Serve dist/ locally. Service worker + PWA install need http://, not file://
serve: build
    cd dist && python3 -m http.server 4173

# Push dist/ to the gh-pages branch
deploy: build
    npx gh-pages -d dist

clean:
    rm -rf dist node_modules
