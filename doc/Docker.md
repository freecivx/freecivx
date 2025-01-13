Podman / Docker setup:
======================


Freeciv-web can easily be built and run from Podman or Docker using `docker-compose`.

 1. Get Podman from: https://podman.io/

 1. Make sure you have both [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

 2. Run the following from the freeciv-web directory:

    ```sh
    docker-compose up -d
    ```

 3. Connect to docker via host machine using standard browser

http://localhost:8080/

Enjoy.
