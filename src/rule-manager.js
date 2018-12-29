const chalk = require('chalk');

inMemoreyRulesByPathId = new Map();
inMemoreyRuleIdPointToRulePathId = new Map();

exports.setInMemoreyRule = (rule) => {
    // We always set in memorey after we write to file so we except to get String JSON.
    const parsedRule = JSON.parse(rule);

    console.log(chalk.yellow(`[CREATE/UPDATE] Rule in memory ${rule}`));

    inMemoreyRuleIdPointToRulePathId.set(parsedRule.id, parsedRule.rulePathId);
    inMemoreyRulesByPathId.set(parsedRule.rulePathId, parsedRule);

    return rule;
}

exports.getFromMemoreyRule = (rulePathId) => {
    console.log(chalk.yellow(`[FETCH] Query rule ${rulePathId} from memory`));

    return inMemoreyRulesByPathId.get(rulePathId);
}

exports.getAllRulesFromMemorey = () => {
    let rulesIterator = inMemoreyRulesByPathId.values();
    let rulesFromMemorey = [];
    let iterator = rulesIterator.next();

    // Run while we iterate over all the rules in memorey.
    while(iterator.done === false) {
        rulesFromMemorey.push(iterator.value);
        iterator = rulesIterator.next();
    }

    return rulesFromMemorey;
}

exports.deleteFromMemoreyRule = (ruleId) => {
    let rulePathId = inMemoreyRuleIdPointToRulePathId.get(ruleId);

    console.log(chalk.yellow(`[DELETE] Deleting from memory ${rulePathId}`));

    if (rulePathId) {
        inMemoreyRuleIdPointToRulePathId.delete(ruleId);
        inMemoreyRulesByPathId.delete(rulePathId);
    }
}