inMemoreyRulesByPathId = new Map();
inMemoreyRuleIdPointToRulePathId = new Map();

exports.setInMemoreyRule = (rule) => {
    // We always set in memorey after we write to file so we except to get String JSON.
    const parsedRule = JSON.parse(rule);

    inMemoreyRuleIdPointToRulePathId.set(parsedRule.id, parsedRule.rulePathId);
    inMemoreyRulesByPathId.set(parsedRule.rulePathId, parsedRule);

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