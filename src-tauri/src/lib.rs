use serde::Serialize;

#[derive(Serialize)]
struct CheckResult {
    correct: bool,
    mismatches: Vec<usize>,
    total: usize,
}

/// Answer checking only. No puzzle solver, network connection, or account is required.
#[tauri::command]
fn check_answer(expected: Vec<String>, actual: Vec<String>) -> CheckResult {
    let n = expected.len().max(actual.len());
    let mismatches: Vec<usize> = (0..n)
        .filter(|&i| expected.get(i) != actual.get(i))
        .collect();
    CheckResult { correct: mismatches.is_empty(), mismatches, total: n }
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
    #[test] fn checks_exactly() {
        let result = check_answer(vec!["1".into(), "2".into()], vec!["1".into(), "3".into()]);
        assert_eq!(result.mismatches, vec![1]);
        assert!(!result.correct);
    }
    #[test] fn catches_short_answers() {
        let result = check_answer(vec!["1".into()], vec![]);
        assert_eq!(result.mismatches, vec![0]);
    }
}
