"""
Run ONCE to make the Invest-Pack data watcher start automatically (minimised)
every time you log into Windows — same idea as the Fixed Income dashboard.

Creates a shortcut in your Startup folder that runs watch_and_run.py in the
background. To undo: run this again and choose Remove, or delete the shortcut
from  shell:startup  (Win+R -> shell:startup -> delete "Invest-Pack Watcher.lnk").
"""
import os
import sys
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
SHORTCUT_NAME = 'Invest-Pack Watcher.lnk'
TARGET_SCRIPT = os.path.join(HERE, 'watch_and_run.py')


def startup_folder():
    return os.path.join(os.environ.get('APPDATA', ''),
                        'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')


def pythonw():
    exe = sys.executable
    cand = os.path.join(os.path.dirname(exe), 'pythonw.exe')
    return cand if os.path.exists(cand) else exe


def create(sc_path):
    ps = f"""
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut('{sc_path}')
$sc.TargetPath       = '{pythonw()}'
$sc.Arguments        = '"{TARGET_SCRIPT}"'
$sc.WorkingDirectory = '{HERE}'
$sc.WindowStyle      = 7
$sc.Description       = 'Invest-Pack data watcher'
$sc.Save()
""".strip()
    r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip())


def main():
    if sys.platform != 'win32':
        print('Windows only.'); input('Press Enter...'); return
    if not os.path.exists(os.path.join(HERE, '.env')):
        print()
        print('  Please run "START DATA WATCHER.bat" once first — it saves your key.')
        print('  Then run this again to add it to startup.')
        input('\n  Press Enter to close...'); return

    sc_path = os.path.join(startup_folder(), SHORTCUT_NAME)
    exists = os.path.exists(sc_path)
    print('\n  Invest-Pack Watcher — Startup Setup\n')
    if exists:
        print('  Already in Windows Startup.')
        choice = input('  [1] Remove  [2] Re-add  [3] Exit : ').strip()
        if choice == '1':
            os.remove(sc_path); print('\n  Removed.')
        elif choice == '2':
            os.remove(sc_path); create(sc_path); print('\n  Updated.')
        else:
            print('\n  No change.')
    else:
        if input('  Start the watcher automatically at login? [y/n]: ').strip().lower() == 'y':
            try:
                create(sc_path)
                print('\n  Added. It will run quietly in the background from next login.')
                print('  (To start it now without restarting, double-click START DATA WATCHER.bat.)')
            except Exception as e:
                print(f'\n  FAILED: {e}')
        else:
            print('\n  No change.')
    input('\n  Press Enter to close...')


if __name__ == '__main__':
    main()
