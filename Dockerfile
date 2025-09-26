# FreecivX docker file
# Dockerfile update based on debian/tomcat package

FROM ubuntu:latest

MAINTAINER FREECIVX : 3.3

RUN DEBIAN_FRONTEND=noninteractive apt-get update --yes --quiet && \
    DEBIAN_FRONTEND=noninteractive apt-get install --yes \
        sudo \
        git \
        lsb-release \
        locales \
        adduser && \
    DEBIAN_FRONTEND=noninteractive apt-get clean --yes && \
    rm --recursive --force /var/lib/apt/lists/*

RUN DEBIAN_FRONTEND=noninteractive locale-gen en_US.UTF-8 && \
    localedef -i en_US -c -f UTF-8 -A /usr/share/locale/locale.alias en_US.UTF-8

ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

## Create user and ensure no passwd questions during scripts
RUN useradd -m docker && echo "docker:docker" | chpasswd && adduser docker sudo && \
    echo "docker ALL = (root) NOPASSWD: ALL\n" > /etc/sudoers.d/docker && \
    chmod 0440 /etc/sudoers.d/docker

## Add relevant content - to be pruned in the future
COPY .git /docker/.git
COPY freeciv /docker/freeciv
COPY freeciv-web /docker/freeciv-web
COPY publite2 /docker/publite2
COPY freecivx-server /docker/freecivx-server
COPY LICENSE.md /docker/LICENSE.md

COPY scripts /docker/scripts
COPY config /docker/config

RUN chown -R docker:docker /docker

USER docker

WORKDIR /docker/scripts/

RUN DEBIAN_FRONTEND=noninteractive sudo apt-get update --yes --quiet && \
    DEBIAN_FRONTEND=noninteractive DEB_NO_TOMCAT=Y \
                                   PIP_SKIP=Y \
                                   bash install/install.sh --mode=TEST_H2 && \
    DEBIAN_FRONTEND=noninteractive sudo apt-get clean --yes && \
    sudo rm --recursive --force /var/lib/apt/lists/*

## Give server access to savegames / scenarios directory.
## TODO: Figure out more targeted solution.
RUN sudo adduser docker tomcat

COPY docker-entrypoint.sh /docker/docker-entrypoint.sh

EXPOSE 80 8080 4002 6000 6001 6002 7000 7001 7002


ENTRYPOINT ["/docker/docker-entrypoint.sh"]

CMD ["/bin/bash"]
