# Useful commands

## Download soundcloud playlist urls and titles

```
yt-dlp --skip-download \
  --print '{"title": %(title)j, "url": %(webpage_url)j}' \
  "https://soundcloud.com/jayasri-sound/sets/sharanagati" \
  > tracks-sharanagati.jsonl
```
