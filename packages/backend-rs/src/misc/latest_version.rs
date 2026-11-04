//! Fetch latest Fedired version from the Fedired repository

use crate::{cache::Cache, util::http_client};
use chrono::Duration;
use futures_util::AsyncReadExt;
use isahc::AsyncReadResponseExt;
use serde::Deserialize;

#[error_doc::errors]
pub enum Error {
    #[error("HTTP request failed")]
    Isahc(#[from] isahc::Error),
    #[error("failed to acquire an HTTP client")]
    HttpClient(#[from] http_client::Error),
    #[doc = "fedired.com returned bad HTTP status"]
    #[error("fedired.com returned bad HTTP status ({0})")]
    BadStatus(String),
    #[error("failed to parse the HTTP response")]
    Io(#[from] std::io::Error),
    #[error("failed to parse the HTTP response as JSON")]
    Json(#[from] serde_json::Error),
}

#[derive(Clone, Deserialize)]
struct PackageJson {
    version: String,
}

const UPSTREAM_PACKAGE_JSON_URL: &str =
    "https://github.com/fedired/fedired/raw/main/package.json";

static PACKAGE_JSON_CACHE: Cache<PackageJson> = Cache::new_with_ttl(Duration::hours(3));

async fn get_package_json() -> Result<PackageJson, Error> {
    // Read up to 1 MiB of the response body
    let mut response = http_client::client()?
        .get_async(UPSTREAM_PACKAGE_JSON_URL)
        .await?
        .map(|body| body.take(1024 * 1024));

    if !response.status().is_success() {
        tracing::info!("status: {}", response.status());
        return Err(Error::BadStatus(response.status().to_string()));
    }

    let package_json: PackageJson = serde_json::from_str(&response.text().await?)?;

    Ok(package_json)
}

/// Returns the latest Fedired version.
#[macros::export]
pub async fn latest_version() -> Result<String, Error> {
    if let Some(package_json) = PACKAGE_JSON_CACHE.get() {
        tracing::trace!("use cached value: {}", package_json.version);
        Ok(package_json.version)
    } else {
        tracing::trace!("cache is expired, fetching the latest version");
        let package_json = get_package_json().await?;

        tracing::trace!("fetched value: {}", package_json.version);

        PACKAGE_JSON_CACHE.set(package_json.clone());
        Ok(package_json.version)
    }
}

#[cfg(test)]
mod unit_test {
    use super::latest_version;
    use pretty_assertions::assert_eq;

    fn validate_version(version: &str) {
        // version: MAJOR.MINOR.PATCH with an optional pre-release suffix,
        // e.g. "0.0.1" or "0.0.1-beta.1"
        let (core, pre_release) = match version.split_once('-') {
            Some((core, pre)) => (core, Some(pre)),
            None => (version, None),
        };

        // MAJOR.MINOR.PATCH
        let parts: Vec<&str> = core.split('.').collect();
        assert_eq!(parts.len(), 3, "invalid version: {version}");
        assert!(
            parts
                .iter()
                .all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit())),
            "invalid version: {version}"
        );

        // -PRE_RELEASE
        if let Some(pre) = pre_release {
            assert!(
                !pre.is_empty()
                    && pre.chars().all(|c| c.is_ascii_alphanumeric() || c == '.'),
                "invalid pre-release in version: {version}"
            );
        }
    }

    #[tokio::test]
    #[cfg_attr(miri, ignore)] // can't call foreign function `getaddrinfo` on OS `linux`
    async fn get_latest_version() {
        // fetch from fedired.com
        let version_1 = latest_version().await.unwrap();
        validate_version(&version_1);

        // use cache
        let version_2 = latest_version().await.unwrap();
        validate_version(&version_2);

        assert_eq!(version_1, version_2);
    }
}
