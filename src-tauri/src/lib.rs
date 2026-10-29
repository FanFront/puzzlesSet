use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CheckResult {
    has_wrong: bool,
    checked: usize,
}

/// Checks *only* user-entered values. The frontend omits untouched cells,
/// original clues and pencil notes. Never returns mistaken positions.
#[tauri::command]
fn check_answer(expected: Vec<String>, actual: Vec<String>) -> CheckResult {
    let has_wrong = expected.len() != actual.len()
        || expected.iter().zip(actual.iter()).any(|(a, b)| a != b);
    CheckResult {
        has_wrong,
        checked: actual.len(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![check_answer])
        .run(tauri::generate_context!())
        .expect("error running puzzlesSet");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_entered_mistake_without_positions() {
        let result = check_answer(vec!["1".into(), "2".into()], vec!["1".into(), "3".into()]);
        assert!(result.has_wrong);
        assert_eq!(result.checked, 2);
    }

    #[test]
    fn empty_entries_are_not_errors() {
        let result = check_answer(vec![], vec![]);
        assert!(!result.has_wrong);
        assert_eq!(result.checked, 0);
    }

    #[test]
    fn matching_partial_entries_are_correct_so_far() {
        let result = check_answer(vec!["2".into()], vec!["2".into()]);
        assert!(!result.has_wrong);
        assert_eq!(result.checked, 1);
    }

    #[test]
    fn rejects_mismatched_lengths() {
        let result = check_answer(vec!["1".into()], vec![]);
        assert!(result.has_wrong);
    }
}
