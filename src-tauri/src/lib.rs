#[tauri::command]
fn finish_startup(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(main) = app.get_webview_window("main") { main.show().map_err(|e| e.to_string())?; let _ = main.set_focus(); }
    if let Some(launcher) = app.get_webview_window("launcher") { launcher.close().map_err(|e| e.to_string())?; }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init());

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .invoke_handler(tauri::generate_handler![finish_startup])
        .run(tauri::generate_context!())
        .expect("error while running Spaces");
}
