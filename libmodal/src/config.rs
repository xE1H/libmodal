//! Client configuration, including profiles and authentiation.

use std::{collections::BTreeMap, env, fs, sync::LazyLock};

use serde::Deserialize;

const DEFAULT_SERVER_URL: &str = "https://api.modal.com:443";

/// Active configuration profile for the client. Only one is active at a time.
#[derive(Debug, Clone)]
pub struct Profile {
    server_url: String,
    token_id: String,
    token_secret: String,
    environment: Option<String>,
}

static CONFIG_FILE: LazyLock<crate::Result<Option<BTreeMap<String, ConfigFileProfile>>>> =
    LazyLock::new(load_config_file);

/// Profile from a config file, which has optional fields.
#[derive(Deserialize)]
struct ConfigFileProfile {
    server_url: Option<String>,
    token_id: Option<String>,
    token_secret: Option<String>,
    environment: Option<String>,
    active: bool,
}

impl ConfigFileProfile {
    fn apply_to_profile(&self, profile: &mut Profile) {
        if let Some(server_url) = &self.server_url {
            profile.server_url = server_url.clone();
        }
        if let Some(token_id) = &self.token_id {
            profile.token_id = token_id.clone();
        }
        if let Some(token_secret) = &self.token_secret {
            profile.token_secret = token_secret.clone();
        }
        if let Some(environment) = &self.environment {
            profile.environment = Some(environment.clone());
        }
    }
}

fn load_config_file() -> crate::Result<Option<BTreeMap<String, ConfigFileProfile>>> {
    let Some(home_dir) = dirs::home_dir() else {
        return Ok(None);
    };
    let config_path = home_dir.join(".modal.toml");
    let Ok(contents) = fs::read_to_string(config_path) else {
        return Ok(None); // If the file does not exist or cannot be read, continue.
    };
    let config: BTreeMap<String, ConfigFileProfile> =
        toml::from_str(&contents).map_err(|e| crate::Error::ConfigError(e.to_string()))?;
    Ok(Some(config))
}

impl Profile {
    /// Load the config from environment variables and a profile file.
    pub fn from_env(profile_name: Option<&str>) -> crate::Result<Self> {
        // Start with the base (default) configuration.
        let mut profile = Profile {
            server_url: DEFAULT_SERVER_URL.to_string(),
            token_id: String::new(),
            token_secret: String::new(),
            environment: None,
        };

        // 1. Load the config file contents if it exists.
        let config_file = match &*CONFIG_FILE {
            Ok(Some(config_file)) => config_file,
            Ok(None) => &Default::default(),
            Err(e) => return Err(e.clone()),
        };

        // 2. Look for a MODAL_PROFILE environment variable, or an activated profile.
        let profile_name =
            profile_name
                .map(|s| s.to_string())
                .or_else(|| match env::var("MODAL_PROFILE") {
                    Ok(s) if s.is_empty() => None,
                    Ok(s) => Some(s),
                    Err(_) => None,
                });
        if let Some(profile_name) = profile_name {
            match config_file.get(&profile_name) {
                Some(p) => p.apply_to_profile(&mut profile),
                None => {
                    return Err(crate::Error::ConfigError(format!(
                        "Profile {profile_name:?} not found in config file",
                    )));
                }
            }
        } else {
            // If no profile is specified, use the first active profile.
            for p in config_file.values() {
                if p.active {
                    p.apply_to_profile(&mut profile);
                    break; // Use the first active profile found.
                }
            }
        }

        // 3. Override with environment variables if they are set.
        if let Ok(server_url) = env::var("MODAL_SERVER_URL") {
            profile.server_url = server_url;
        }
        if let Ok(token_id) = env::var("MODAL_TOKEN_ID") {
            profile.token_id = token_id;
        }
        if let Ok(token_secret) = env::var("MODAL_TOKEN_SECRET") {
            profile.token_secret = token_secret;
        }
        if let Ok(environment) = env::var("MODAL_ENVIRONMENT") {
            profile.environment = Some(environment);
        }

        // 4. Validate that the profile has the required fields.
        if profile.token_id.is_empty() || profile.token_secret.is_empty() {
            return Err(crate::Error::ConfigMissing);
        }

        Ok(profile)
    }
}
