param([int]$BrowserPid,[string]$WindowTitle)
if ($WindowTitle) {
 $taskCandidates = @(Get-Process chrome,msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "$WindowTitle*" })
 if ($taskCandidates.Count -ne 1) { throw 'Test window identity is ambiguous' }
 $taskBrowser = $taskCandidates[0]
} else { $taskBrowser = Get-Process -Id $BrowserPid -ErrorAction Stop }
if ($taskBrowser.MainWindowTitle -notlike 'SOLARIS*') { throw 'Not a SOLARIS test browser' }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SolarisTestWindow {
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int state);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
 [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a,uint b,bool attach);
 [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
}
'@
$taskRestored = [SolarisTestWindow]::ShowWindowAsync($taskBrowser.MainWindowHandle,9)
$taskThread = [SolarisTestWindow]::GetCurrentThreadId()
$taskForegroundThread = [SolarisTestWindow]::GetWindowThreadProcessId([SolarisTestWindow]::GetForegroundWindow(),[IntPtr]::Zero)
$taskAttached = $false
try {
 if ($taskThread -ne $taskForegroundThread) { $taskAttached = [SolarisTestWindow]::AttachThreadInput($taskThread,$taskForegroundThread,$true) }
 $taskRaised = [SolarisTestWindow]::BringWindowToTop($taskBrowser.MainWindowHandle)
 $taskActivated = [SolarisTestWindow]::SetForegroundWindow($taskBrowser.MainWindowHandle)
} finally { if ($taskAttached) { [void][SolarisTestWindow]::AttachThreadInput($taskThread,$taskForegroundThread,$false) } }
@{Pid=$taskBrowser.Id;ExpectedWindow=$taskBrowser.MainWindowHandle.ToInt64();ActualForeground=[SolarisTestWindow]::GetForegroundWindow().ToInt64();Activated=$taskActivated} | ConvertTo-Json -Compress
