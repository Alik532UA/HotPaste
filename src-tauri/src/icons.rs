//! ЗНАЧКИ ЯРЛИКІВ: витяг, кеш, збереження.
//!
//! Витяг іде через PowerShell пакетами, бо кожен окремий запуск коштує
//! приблизно стільки ж, скільки сотня іконок у пакеті.

use crate::state::CREATE_NO_WINDOW;
use futures::future::join_all;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tokio::time::timeout;

#[tauri::command]
pub(crate) async fn get_shortcut_icons_batch(
    app: AppHandle,
    paths: Vec<String>,
) -> Result<Vec<(String, String)>, String> {
    #[cfg(target_os = "windows")]
    {
        use base64::{engine::general_purpose, Engine as _};
        use md5;

        let docs = app.path().document_dir().map_err(|e| e.to_string())?;
        let cache_dir = docs
            .join("HotPaste")
            .join(".assets")
            .join("cache")
            .join("icons");
        if !cache_dir.exists() {
            let _ = std::fs::create_dir_all(&cache_dir);
        }

        let mut results = Vec::new();
        let mut missing_paths = Vec::new();

        for path in &paths {
            let hash = format!("{:x}", md5::compute(path.as_bytes()));
            let cache_file = cache_dir.join(format!("{}.png", hash));

            if cache_file.exists() {
                if let Ok(data) = std::fs::read(&cache_file) {
                    results.push((path.clone(), general_purpose::STANDARD.encode(data)));
                    continue;
                }
            }
            missing_paths.push(path.clone());
        }

        if missing_paths.is_empty() {
            return Ok(results);
        }

        let futures = missing_paths.into_iter().map(|path| {
            let cache_dir_clone = cache_dir.clone();
            async move {
                let path_clone = path.clone();
                let result = timeout(Duration::from_secs(3), async {
                    extract_single_icon(path_clone).await
                })
                .await;

                match result {
                    Ok(Ok(b64)) => {
                        let hash = format!("{:x}", md5::compute(path.as_bytes()));
                        let cache_file = cache_dir_clone.join(format!("{}.png", hash));
                        if let Ok(binary_data) = general_purpose::STANDARD.decode(&b64) {
                            let _ = std::fs::write(&cache_file, binary_data);
                        }
                        Some((path, b64))
                    }
                    _ => None,
                }
            }
        });

        let extracted: Vec<(String, String)> =
            join_all(futures).await.into_iter().flatten().collect();
        results.extend(extracted);

        Ok(results)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Not supported".to_string())
    }
}

pub(crate) async fn extract_single_icon(path: String) -> Result<String, String> {
    use base64::{engine::general_purpose, Engine as _};

    let script = format!(
        r##"$ErrorActionPreference = 'SilentlyContinue'; $WarningPreference = 'SilentlyContinue'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
[void][Reflection.Assembly]::LoadWithPartialName('System.Drawing');

if (-not ([System.Management.Automation.PSTypeName]'JumboIcon').Type) {{
    try {{
        Add-Type -TypeDefinition @"
#pragma warning disable
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Collections.Generic;

public class JumboIcon {{
    [StructLayout(LayoutKind.Sequential)]
    public struct SIZE {{
        public int cx;
        public int cy;
    }}

    [ComImport]
    [Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IShellItemImageFactory {{
        [PreserveSig]
        int GetImage([In, MarshalAs(UnmanagedType.Struct)] SIZE size, [In] int flags, [Out] out IntPtr phbm);
    }}

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    public static extern int SHCreateItemFromParsingName(
        [In, MarshalAs(UnmanagedType.LPWStr)] string pszPath,
        [In] IntPtr pbc,
        [In, MarshalAs(UnmanagedType.LPStruct)] Guid riid,
        [Out, MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory ppv);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAP {{
        public int bmType;
        public int bmWidth;
        public int bmHeight;
        public int bmWidthBytes;
        public ushort bmPlanes;
        public ushort bmBitsPixel;
        public IntPtr bmBits;
    }}

    [DllImport("gdi32.dll")]
    public static extern int GetObject(IntPtr hgdiobj, int cbBuffer, out BITMAP lpvObject);

    public static string GetBase64(string path, int targetSize) {{
        if (string.IsNullOrEmpty(path)) return "";
        string b64 = ExtractAndProcess(path, targetSize);
        if (targetSize > 48 && !string.IsNullOrEmpty(b64)) {{
            try {{
                byte[] data = Convert.FromBase64String(b64);
                using (var ms = new System.IO.MemoryStream(data))
                using (var bmp = new Bitmap(ms)) {{
                    float density = GetSolidDensity(bmp);
                    if (density < 0.20f) {{
                        string fallbackB64 = ExtractAndProcess(path, 48);
                        if (!string.IsNullOrEmpty(fallbackB64)) return fallbackB64;
                    }}
                }}
            }} catch {{ }}
        }}
        return b64;
    }}

    private static string ExtractAndProcess(string path, int size) {{
        IntPtr hBitmap = IntPtr.Zero;
        try {{
            IShellItemImageFactory factory;
            Guid guid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
            int hr = SHCreateItemFromParsingName(path, IntPtr.Zero, guid, out factory);
            if (hr == 0 && factory != null) {{
                SIZE s = new SIZE {{ cx = size, cy = size }};
                hr = factory.GetImage(s, 0x4, out hBitmap);
                if (hr == 0 && hBitmap != IntPtr.Zero) {{
                    BITMAP bm;
                    GetObject(hBitmap, Marshal.SizeOf(typeof(BITMAP)), out bm);
                    Bitmap finalBmp = null;
                    if (bm.bmBitsPixel == 32 && bm.bmBits != IntPtr.Zero) {{
                        using (Bitmap temp = new Bitmap(bm.bmWidth, bm.bmHeight, bm.bmWidthBytes, PixelFormat.Format32bppArgb, bm.bmBits)) {{
                            finalBmp = new Bitmap(temp);
                            finalBmp.RotateFlip(RotateFlipType.RotateNoneFlipY);
                        }}
                    }} else {{
                        finalBmp = Bitmap.FromHbitmap(hBitmap);
                    }}
                    try {{
                        if (finalBmp != null) {{
                            Bitmap croppedBmp = CropTransparent(finalBmp, 25);
                            try {{
                                using (System.IO.MemoryStream ms = new System.IO.MemoryStream()) {{
                                    croppedBmp.Save(ms, ImageFormat.Png);
                                    return Convert.ToBase64String(ms.ToArray());
                                }}
                            }} finally {{
                                if (croppedBmp != finalBmp) croppedBmp.Dispose();
                            }}
                        }}
                    }} finally {{
                        if (finalBmp != null) finalBmp.Dispose();
                        DeleteObject(hBitmap);
                    }}
                }}
            }}
        }} catch {{ }} finally {{ if (hBitmap != IntPtr.Zero) DeleteObject(hBitmap); }}
        if (size <= 48) {{
            try {{
                using (Icon assocIcon = Icon.ExtractAssociatedIcon(path)) {{
                    if (assocIcon != null) {{
                        using (Bitmap bmp = assocIcon.ToBitmap())
                        using (System.IO.MemoryStream ms = new System.IO.MemoryStream()) {{
                            bmp.Save(ms, ImageFormat.Png);
                            return Convert.ToBase64String(ms.ToArray());
                        }}
                    }}
                }}
            }} catch {{ }}
        }}
        return "";
    }}

    private static float GetSolidDensity(Bitmap bmp) {{
        int w = bmp.Width;
        int h = bmp.Height;
        BitmapData data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try {{
            int solidPixels = 0;
            int[] pixels = new int[w * h];
            Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
            for (int i = 0; i < pixels.Length; i++) {{ if (((pixels[i] >> 24) & 0xFF) > 30) solidPixels++; }}
            return (float)solidPixels / (w * h);
        }} finally {{ bmp.UnlockBits(data); }}
    }}

    private static Bitmap CropTransparent(Bitmap bmp, int threshold) {{
        int w = bmp.Width;
        int h = bmp.Height;
        BitmapData data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try {{
            int top = h, bottom = 0, left = w, right = 0;
            int[] pixels = new int[w * h];
            Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
            for (int y = 0; y < h; y++) {{
                for (int x = 0; x < w; x++) {{
                    int alpha = (pixels[y * w + x] >> 24) & 0xFF;
                    if (alpha > threshold) {{
                        if (x < left) left = x; if (x > right) right = x;
                        if (y < top) top = y; if (y > bottom) bottom = y;
                    }}
                }}
            }}
            if (right < left || bottom < top) return bmp;
            int cropW = right - left + 1; int cropH = bottom - top + 1;
            if (cropW == w && cropH == h) return bmp;
            return bmp.Clone(new Rectangle(left, top, cropW, cropH), bmp.PixelFormat);
        }} catch {{ return bmp; }} finally {{ bmp.UnlockBits(data); }}
    }}
}}
"@ -ReferencedAssemblies System.Drawing, System.Windows.Forms
    }} catch {{ }}
}}

$p = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('{}'))
$b64 = ""

# 1. Try direct path first (if file exists)
if (Test-Path -LiteralPath $p) {{
    $b64 = [JumboIcon]::GetBase64($p, 256)
}}

# 2. If failed (or virtual path), try via shell:AppsFolder
if ([string]::IsNullOrEmpty($b64)) {{
    $virtualPath = "shell:AppsFolder\$p"
    $b64 = [JumboIcon]::GetBase64($virtualPath, 256)
}}

# 3. Fallback for .lnk if it's a real file path
if ([string]::IsNullOrEmpty($b64) -and (Test-Path -LiteralPath $p) -and $p.EndsWith('.lnk')) {{
    try {{
        $wsh = New-Object -ComObject WScript.Shell
        $link = $wsh.CreateShortcut($p)
        if ($link.TargetPath -and (Test-Path -LiteralPath $link.TargetPath)) {{ 
            $b64 = [JumboIcon]::GetBase64($link.TargetPath, 256)
        }}
    }} catch {{ }}
}}

if (![string]::IsNullOrEmpty($b64)) {{ 
    Write-Output "---B64_START---$b64" 
}}
"##,
        general_purpose::STANDARD.encode(path.as_bytes())
    );

    let utf16_script: Vec<u16> = script.encode_utf16().collect();
    let u8_script: Vec<u8> = utf16_script
        .iter()
        .flat_map(|&u| u.to_le_bytes().to_vec())
        .collect();
    let encoded_script = general_purpose::STANDARD.encode(&u8_script);

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            &encoded_script,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;

    let result_str = String::from_utf8_lossy(&output.stdout).to_string();
    if let Some(idx) = result_str.find("---B64_START---") {
        return Ok(result_str[idx + "---B64_START---".len()..]
            .trim()
            .to_string());
    }

    Err("Icon not found".to_string())
}

#[tauri::command]
pub(crate) async fn get_shortcut_icon(app: AppHandle, path: String) -> Result<String, String> {
    let results = get_shortcut_icons_batch(app, vec![path.clone()]).await?;
    for (p, b64) in results {
        if p == path {
            return Ok(b64);
        }
    }
    Err("Failed".to_string())
}

#[tauri::command]
pub(crate) async fn clear_icon_cache(app: AppHandle) -> Result<(), String> {
    let docs = app.path().document_dir().map_err(|e| e.to_string())?;
    let cache_dir = docs.join("HotPaste").join("start").join("icon-cache");
    if cache_dir.exists() {
        let _ = std::fs::remove_dir_all(&cache_dir);
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn save_icon(
    app: AppHandle,
    name: String,
    base64_data: String,
) -> Result<String, String> {
    use base64::{engine::general_purpose, Engine as _};
    let docs = app.path().document_dir().map_err(|e| e.to_string())?;
    let icon_dir = docs.join("HotPaste").join(".assets").join("icons");
    if !icon_dir.exists() {
        std::fs::create_dir_all(&icon_dir).map_err(|e| e.to_string())?;
    }

    let clean_name = name
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>();
    let file_name = format!("{}.png", clean_name);
    let file_path = icon_dir.join(&file_name);

    let data = general_purpose::STANDARD
        .decode(base64_data.replace("data:image/png;base64,", ""))
        .map_err(|e| e.to_string())?;
    std::fs::write(&file_path, data).map_err(|e| e.to_string())?;

    Ok(file_name)
}
