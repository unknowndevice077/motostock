use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let migrations = vec![
    Migration {
      version: 1,
      description: "init_core_schema",
      sql: include_str!("../migrations/0001_init.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 2,
      description: "add_avatar",
      sql: include_str!("../migrations/0002_add_avatar.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 3,
      description: "add_shop_logo",
      sql: include_str!("../migrations/0003_add_shop_logo.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 4,
      description: "add_cloud_provisioned",
      sql: include_str!("../migrations/0004_add_cloud_provisioned.sql"),
      kind: MigrationKind::Up,
    },
  ];

  let builder = tauri::Builder::default().plugin(
    tauri_plugin_sql::Builder::default()
      .add_migrations("sqlite:motostock.db", migrations)
      .build(),
  );

  // Updater/process aren't supported on mobile targets — desktop-only, same
  // as every shop actually running this app.
  #[cfg(desktop)]
  let builder = builder
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init());

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
