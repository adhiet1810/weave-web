# Weave — static, local-first build.
#
# Weave needs no database and no backend: the graph lives in the user's browser
# and the AI runs on the user's own key. So the whole app is just the contents
# of public/ served as static files.
#
#   docker build -t weave .
#   docker run --rm -p 8080:80 weave
#
# (The optional Cloudflare Pages Functions backend is NOT part of this image —
#  see the README if you want the server-backed mode.)

FROM nginx:alpine

# The app itself: index.html plus the bundled example graphs.
COPY public/ /usr/share/nginx/html/

# Don't cache index.html (so users get updates), do cache the example bundles.
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  location = /index.html { add_header Cache-Control "no-cache"; }' \
  '  location /examples/ { add_header Cache-Control "public, max-age=86400"; }' \
  '  location / { try_files $uri $uri/ /index.html; }' \
  '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
