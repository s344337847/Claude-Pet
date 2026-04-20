use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Colors {
    pub primary: String,
    pub work: String,
    pub success: String,
    pub fail: String,
    pub sleep: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub scale: u32,
    pub size_preset: String,
    pub fps_limit: u32,
    pub colors: Colors,
    pub monitor: Option<String>,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default)]
    pub style_name: String,
}

fn default_language() -> String {
    "en".to_string()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            scale: 4,
            size_preset: "medium".to_string(),
            fps_limit: 60,
            colors: Colors {
                primary: "#6b8cff".to_string(),
                work: "#ffaa44".to_string(),
                success: "#6b8cff".to_string(),
                fail: "#889999".to_string(),
                sleep: "#6b8cff".to_string(),
            },
            monitor: None,
            language: "en".to_string(),
            style_name: String::new(),
        }
    }
}

pub fn preset_for_scale(scale: u32) -> &'static str {
    match scale {
        2 => "small",
        4 => "medium",
        6 => "large",
        _ => "custom",
    }
}
