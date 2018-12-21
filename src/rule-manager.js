inMemoreyRulesByPathId = new Map();
inMemoreyRuleIdPointToRulePathId = new Map();

exports.setInMemoreyRule = (rule) => {
    inMemoreyRuleIdPointToRulePathId.set(rule.id, rule.rulePathId);
    inMemoreyRulesByPathId.set(rule.rulePathId, rule);

    return rule;
}

exports.getFromMemoreyRule = (rulePathId) => {
    return inMemoreyRulesByPathId.get(rulePathId);
}

exports.deleteFromMemoreyRule = (ruleId) => {
    let rulePathId = inMemoreyRuleIdPointToRulePathId.get(ruleId);

    if (rulePathId) {
        inMemoreyRuleIdPointToRulePathId.delete(ruleId);
        inMemoreyRulesByPathId.delete(rulePathId);
    }
}