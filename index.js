const path = require('path');
const fs = require('fs');

module.exports = function invincibility(mod) {
    const command = mod.command;
    let cid = null;
    let enabled = false;
    let myPosition = null;
    let myAngle = null;
    let packet_loc = null;
    let intervalId = null;
    let zval = 300;
    let zbug = 0;

    function loadSettings() {
        const settingsPath = path.join(__dirname, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            try {
                const raw = fs.readFileSync(settingsPath);
                const parsed = JSON.parse(raw);
                zval = parsed.zval || 300;
                command.message(`Settings loaded. zval: ${zval}`);
            } catch (e) {
                command.message('Failed to load settings.json');
            }
        }
    }

    loadSettings();

    mod.hook('S_LOGIN', 14, (event) => {
        cid = event.gameId;
    });

    mod.hook('C_PLAYER_LOCATION', 5, (event) => {
        myPosition = event.loc;
        myAngle = event.w;
        packet_loc = event;
    });

    // Force player Z-height when client sends movement updates (e.g., skill casting)
    mod.hook('C_PLAYER_LOCATION', 5, { order: 999999, filter: { fake: null } }, event => {
        if (enabled && zbug) {
            event.loc.z = zbug;
            event.dest.z = zbug;
            return true;
        }
    });

    mod.hook('C_START_SKILL', 7, () => {
        if (enabled && !intervalId) {
            intervalId = setInterval(sendModifiedPosition, 500);
        }
    });

    mod.hook('C_USE_ITEM', 3, (event) => {
        if (event.id !== 6560) return;

        enabled = !enabled;

        if (enabled) {
            zbug = myPosition.z + zval;

            mod.send('S_ABNORMALITY_BEGIN', 4, {
                target: cid,
                source: cid,
                id: 2060,
                duration: 0x7FFFFFFF,
                unk: 0,
                stacks: 1,
                unk2: 0,
                unk3: 0
            });

            sendModifiedPosition();

            if (!intervalId) {
                intervalId = setInterval(sendModifiedPosition, 500);
            }

            command.message('Invincibility ON');
        } else {
            mod.send('S_ABNORMALITY_END', 1, {
                target: cid,
                id: 2060
            });

            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }

            mod.send('C_PLAYER_LOCATION', 5, Object.assign({}, packet_loc, {
                loc: { x: myPosition.x, y: myPosition.y, z: myPosition.z },
                dest: { x: myPosition.x, y: myPosition.y, z: myPosition.z }
            }));

            command.message('Invincibility OFF');
        }

        return false;
    });

    command.add('reloadz', () => {
        loadSettings();
    });

    function sendModifiedPosition() {
        if (packet_loc && myPosition) {
            mod.send('C_PLAYER_LOCATION', 5, Object.assign({}, packet_loc, {
                loc: { x: myPosition.x, y: myPosition.y, z: zbug },
                dest: { x: myPosition.x, y: myPosition.y, z: zbug }
            }));
        }
    }
};
