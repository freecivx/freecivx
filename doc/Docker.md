Podman setup:
======================

FreecivX can easily be built and run from Podman.

 1. Get Podman from: https://podman.io/

 2. Run the following from the freeciv-web directory as root:

    ```sh
    su
    cd freecivx
    podman build -t freecivx .
    podman run -d -p 80:80 --name freecivxyz freecivx:latest
    ```

 3. Connect to docker via host machine using standard browser

http://localhost:8080/



Docker setup:
=============

FreecivX can easily be built and run fromDocker using `docker-compose`.

 1. Make sure you have both [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

 2. Run the following from the freeciv-web directory:

    ```sh
    docker-compose up -d
    ```

 3. Connect to docker via host machine using standard browser

http://localhost:8080/


