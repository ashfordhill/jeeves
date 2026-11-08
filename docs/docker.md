# Run Jeeves with Docker

Docker is the only prerequisite. The image includes the web app, API and PostgreSQL 17.

```sh
docker pull ghcr.io/ashfordhill/jeeves:latest
docker run -d --name jeeves --restart unless-stopped --stop-timeout 30 -p 127.0.0.1:4300:4300 -v jeeves-data:/data ghcr.io/ashfordhill/jeeves:latest
```

Open **http://localhost:4300**. On an empty volume, the first browser visit creates and opens
an editable copy of the TinyURL study. Existing projects are preserved and the last selected
project opens on later visits. The image supports Linux AMD64 and ARM64, including Docker Desktop.

`jeeves-data` is created automatically. It holds the database and Jeeves settings. Recreating the container with that same
volume keeps your work. Your existing development database is separate; it is not imported.
If port 4300 is already occupied, change the mapping to `127.0.0.1:4302:4300` and open port 4302.

## Update

```sh
docker pull ghcr.io/ashfordhill/jeeves:latest
docker stop jeeves
docker rm jeeves
docker run -d --name jeeves --restart unless-stopped --stop-timeout 30 -p 127.0.0.1:4300:4300 -v jeeves-data:/data ghcr.io/ashfordhill/jeeves:latest
```

Database migrations run automatically at startup. Back up the volume before upgrades. Keep the
container stopped while copying the entire volume for a consistent database backup. Do not delete
the volume to update the image. To pin a build, use its `sha-<full commit hash>` tag or image digest.

## Operation

```sh
docker logs -f jeeves
docker inspect --format '{{.State.Health.Status}}' jeeves
docker stop jeeves
docker start jeeves
```

The health check checks the API and database through the same HTTP port as the UI. Nginx serves
the production web build and forwards `/api/`, including streamed chat responses. The API
and bundled database listen only on container loopback. The run command publishes the UI only on
the host's loopback address; Jeeves remains a local, single-user application without account login.
The API, database and nginx run as unprivileged users. The entrypoint initializes volume ownership,
supervises all three processes, and shuts the API down before stopping Postgres.

You can supply `DATABASE_URL` to use an existing PostgreSQL server instead of the bundled one.
Jeeves still needs its `/data` volume for settings and files. The external database must be reachable
from the container and its role must be allowed to apply Jeeves's migrations.

The studio needs no model credentials. Configure an optional chat provider in Settings. The
image does not include a Docker daemon or mount the host Docker socket.

## Publishing

[The Docker workflow](../.github/workflows/docker.yml) builds and
pushes `ghcr.io/ashfordhill/jeeves:latest` and a commit-specific tag on every normal push to `main`.
It can also be started manually on `main`. GitHub Actions supplies the registry credentials through
`GITHUB_TOKEN`; no repository secret is needed. Builds are serialized so older builds cannot
overwrite a newer `latest`. The workflow starts the published commit image and checks it again
after a restart before moving `latest` to that image. GitHub's `[skip ci]` commit directive skips
this workflow too.

The repository stays private. The image is public, so pulls need no login. If publishing under
a new package name, GitHub initially creates it as private: after the first publication, its
owner must change the **package's** visibility to **Public** in
[package settings](https://github.com/users/ashfordhill/packages/container/jeeves/settings).
This is a one-time package setting, independent of repository visibility; GitHub does not expose
it through the supported Packages REST API. See
[GitHub's package visibility guide](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility).

For a local build from the checkout:

```sh
docker build -f jeeves/Dockerfile -t jeeves:local .
docker run -d --name jeeves-local --stop-timeout 30 -p 127.0.0.1:4302:4300 -v jeeves-local-data:/data jeeves:local
```
