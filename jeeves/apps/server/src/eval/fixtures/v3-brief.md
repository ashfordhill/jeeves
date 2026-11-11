Please design YouTube v3 for me on a blank board.

The system is called YouTube. There are two actions: viewers Watch, and creators Publish.

Names should not repeat the kind, because each tile already shows it: call the database "Metadata", not "Metadata database".

**Watching.** Watch leads to four tiles: the Watch API service, the Search API service, the Video delivery CDN and the Account API service.

- Watch API keeps video details in its own cache, Hot metadata, and loads them from the Metadata database when they aren't cached. It reads view totals from the View counts database and reports every play on the View events topic. It also checks sign-in against Sign-in.
- A View counter worker takes the View events and writes the totals into View counts.
- Search API searches the Videos search index.
- Video delivery serves the files in Transcoded videos.
- Account API keeps each account's favorites in its own Favorites database, reads Metadata to see which videos are public, and checks sign-in against Sign-in.

**Publishing.** Publish leads to two tiles: Sign-in, the identity provider, and the Upload API, which takes uploads.

- Upload API checks sign-in against Sign-in, records each upload in Metadata, stores the files in the Original videos object storage and puts a job on the Upload jobs queue.
- A Transcoder worker takes the jobs, reads Original videos, writes Transcoded videos (another object storage) and announces the results on the Processing events topic.
- A Video lifecycle worker takes the Processing events, updates Metadata and announces published videos on the Publication events topic.
- A Search indexer worker takes the Publication events and writes the Videos index.

Only the four topic and queue paths are asynchronous; everything else is a direct call.

**Modules.** Give each tile these modules, with these names and descriptions.

Watch API:
- Viewer check, an Auth guard on Sign-in, with sign-in set to Optional: "Lets watchers sign in; others watch anonymously."
- Video details cache, a Cache reader on Hot metadata that loads misses through Video details reader: "Serves video details from the cache."
- Video details reader, a Data access on Metadata: "Reads public video details."
- View count reader, a Data access on View counts: "Reads a video's view count."
- View publisher, a Custom module that uses View events and Metadata, because it only accepts plays of ready videos: "Reports each play of a ready video as an event, with the viewer when signed in."

View counter:
- View consumer, an Event consumer of View events: "Receives view events."
- Receipt and increment, an Event counter: "Counts each view event once."
- Count writer, a Data access on View counts: "Stores view totals."

Search API:
- Video search, a Search query on Videos: "Searches published videos."

Account API:
- Account check, an Auth guard on Sign-in, left at Required: "Allows only signed-in accounts."
- Favorite videos, a Favorites module that keeps its state in Favorites and takes its items from Video reader: "Keeps each account's favorite videos."
- Video reader, a Data access on Metadata: "Reads which videos are public."

Upload API:
- Creator check, an Auth guard on Sign-in, left at Required: "Allows only signed-in creators."
- Multipart uploads, a Multipart uploads module on Original videos: "Uploads large videos in resumable parts."
- Job outbox publisher, an Event publisher to Upload jobs with its outbox in Metadata: "Queues a processing job once an upload completes."
- Upload state writer, a Data access on Metadata: "Records each upload's progress."

Transcoder:
- Job consumer, an Event consumer of Upload jobs: "Takes the next processing job."
- Segmenter and encoder, a Video encoder reading Original videos: "Encodes the video into streamable renditions."
- Packager, a Video packager writing Transcoded videos: "Stores the stream's segments and playlists."
- Thumbnailer, a Video thumbnailer writing Transcoded videos: "Creates the video's thumbnails."
- Processing result publisher, an Event publisher to Processing events: "Announces whether processing succeeded."

Video lifecycle:
- Processing consumer, an Event consumer of Processing events: "Receives processing results."
- Lifecycle writer, a Lifecycle writer on Metadata: "Updates each video's processing state."
- Video publication publisher, an Event publisher to Publication events with its outbox in Metadata: "Announces videos that are ready to watch."

Search indexer:
- Video publication consumer, an Event consumer of Publication events: "Receives newly published videos."
- Index writer, an Index writer on Videos: "Adds published videos to the search index."

**Values.** Set Upload API's request timeout to 5000 ms and its concurrency limit to 500, Watch API's concurrency limit to 2000, Video details reader's pool size to 50 and statement timeout to 500 ms, Hot metadata's TTL to 3601 seconds and View counter's concurrency to 8. Leave everything else at its initial value.

Finally, turn on Runnable processes.
