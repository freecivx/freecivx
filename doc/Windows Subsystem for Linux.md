Run FreecivWorld.net on Windows Subsystem for Linux (WSL)

=================================================

Allows running Freecivworld on an Ubuntu Linux in Windows. 
This might be a good development environment for Freecivworld. 
Remember to disable Windows realtime antivirus to get good performance.

  
## 1. Running Freecivworld on WSL:

### 1.1. Install WSL on Windows 11:

https://learn.microsoft.com/en-us/windows/wsl/install

Open a Powershell window, run as Administator, this command:

> wsl --install

  

### 1.2. Git clone Freecivworld:

> git clone https://github.com/freecivworld/freecivworld.git --depth=10

  

### 1.3. Build Freeciworld:

> cd freecivworld

> bash ./scripts/install/install.sh --mode=TEST_MYSQL

  

### 1.4. Start Freecivworld:

> ./scripts/start-freeciv-web.sh

  

### Open Freecivworld at http://localhost/


