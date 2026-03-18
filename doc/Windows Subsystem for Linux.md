Run Freecivx.com on Windows Subsystem for Linux (WSL)

=================================================

Allows running Freecivx on an Ubuntu Linux in Windows. 
This might be a good development environment for Freecivx. 
Remember to disable Windows realtime antivirus to get good performance.

  
## 1. Running Freecivx on WSL:

### 1.1. Install WSL on Windows 11:

https://learn.microsoft.com/en-us/windows/wsl/install

Open a Powershell window, run as Administator, this command:

> wsl --install

  

### 1.2. Git clone Freecivx:

> git clone https://github.com/freecivx/freecivx.git --depth=10

  

### 1.3. Build Freeciworld:

> cd freecivx

> bash ./scripts/install/install.sh --mode=TEST_MYSQL

  

### 1.4. Start Freecivx:

> ./scripts/start-freeciv-web.sh

  

### Open Freecivx at http://localhost/


