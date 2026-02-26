
/**************************************************************************
 ...
**************************************************************************/


function init_xterm() {

  const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1b1b1b'
      }
    });

    term.open(document.getElementById('terminal'));
    term.writeln('Running \x1B[1;32mxterm.js v6.0.0\x1B[0m');
    term.write('\r\n$ ');

    // Basic local echo so you can type
    term.onData(e => {
      switch (e) {
        case '\r': // Enter
          term.write('\r\n$ ');
          break;
        case '\u007F': // Backspace (DEL)
          if (term.buffer.active.cursorX > 2) {
            term.write('\b \b');
          }
          break;
        default:
          term.write(e);
      }
    });

}