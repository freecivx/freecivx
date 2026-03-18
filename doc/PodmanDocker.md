Podman setup (preferred):
=========================

Freecivx can easily be built and run using Podman.

 1. Get Podman from: https://podman.io/

 2. Run the following from the freecivx directory:

    ```sh
    podman build -t freecivx .
    podman run -d -p 8080:80 -p 4002:4002 -p 6000-6009:6000-6009 -p 7000-7009:7000-7009 --name freecivx freecivx:latest
    ```

 3. Connect via your browser:

    http://localhost:8080/


Docker setup:
=============

Freecivx can also be built and run using Docker with `docker-compose`.

 1. Make sure you have both [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

 2. Run the following from the freecivx directory:

    ```sh
    docker-compose up -d
    ```

 3. Connect via your browser:

    http://localhost:8080/
