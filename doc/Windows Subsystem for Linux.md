Run FreecivX.net on Windows Subsystem for Linux (WSL)

=================================================

  

Allows running Freecivx on an Ubuntu Linux in Windows. 
This might be a good development environment for Freecivx. 
Remember to disable Windows realtime antivirus to get good performance.

  
## 1. Running FreecivX on WSL:

### 1.1. Install WSL on Windows 11:

https://learn.microsoft.com/en-us/windows/wsl/install

Open a Powershell window, run as Administator, this command:

> wsl --install

  

### 1.2. Git clone FreecivX:

> git clone https://github.com/freecivx/freecivx.git --depth=10

  

### 1.3. Build FreeciX:

> cd freecivx

> bash ./scripts/install/install.sh --mode=TEST_MYSQL

  

### 1.4. Start FreecivX:

> ./scripts/start-freeciv-web.sh

  

### Open FreecivX at http://localhost/

<br />

