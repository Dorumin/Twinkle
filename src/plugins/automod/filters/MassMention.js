const Filter = require('../structs/filter.js');

class MassMentionFilter extends Filter {
    interested(message) {
        if (message.member.permissions.hasPermission('MANAGE_MESSAGES')) return false;

        if (message.mentions.users.size < 6) return;

        return true;
    }

    handle(message) {
        console.log('Too many mentions:', message.content);
    }
}

module.exports = MassMentionFilter;