#!/usr/bin/env bash
# PF13 F3 helper: upload one video, poll its asset state every 0.5 s, and when it is
# `processing`, docker kill the transcoder whose `docker top` lists an ffmpeg process; wait 5 s;
# docker start it. Usage: f3-catch.sh <label> <word>. Writes $S/pf13/<label>-catch.txt.
set -u
. "$(dirname "$0")/../env.sh"
label=$1 word=$2
out="$S/pf13/$label-catch.txt"
sql() { docker exec jeeves-pf12-local-postgres-1 psql -U postgres -d d_metadata -Atc "$1"; }
cd "$S/harness" || exit 1
echo "upload at $(date -u +%T.%N)" > "$out"
node upload.mjs "$label" "fixture:$word" > "$S/pf13/$label-upload.out" 2>&1 || { echo "upload failed" >> "$out"; exit 1; }
id=$(cat "runs/$label-ids")
echo "uploaded $id at $(date -u +%T.%N)" >> "$out"
killed=""
for i in $(seq 1 400); do
  state=$(sql "select state from upload_api_multipart_uploads.assets where asset_id='$id'")
  echo "$(date -u +%T.%N) state=$state" >> "$out"
  if [ "$state" = processing ] && [ -z "$killed" ]; then
    for c in jeeves-pf12-app-transcoder-1 jeeves-pf12-app-transcoder-2; do
      top=$(docker top "$c" 2>&1)
      if printf '%s\n' "$top" | command grep -q 'ffmpeg'; then
        echo "$(date -u +%T.%N) ffmpeg in $c:" >> "$out"
        printf '%s\n' "$top" | command grep -E 'ffmpeg|node' | cut -c1-240 >> "$out"
        echo "$(date -u +%T.%N) docker kill $c" >> "$out"
        docker kill "$c" >> "$out" 2>&1
        echo "$(date -u +%T.%N) killed; sleeping 5 s" >> "$out"
        sleep 5
        echo "$(date -u +%T.%N) docker start $c" >> "$out"
        docker start "$c" >> "$out" 2>&1
        echo "$(date -u +%T.%N) started" >> "$out"
        killed=$c
        break
      fi
    done
    [ -z "$killed" ] && echo "$(date -u +%T.%N) processing, no ffmpeg in either transcoder" >> "$out"
  fi
  case "$state" in
    ready | failed) break ;;
  esac
  [ -n "$killed" ] && break
  sleep 0.5
done
echo "result: id=$id killed=${killed:-none} lastState=$state at $(date -u +%T.%N)" >> "$out"
cat "$out"
