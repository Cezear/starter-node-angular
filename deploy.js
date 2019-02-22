var cmd = require('node-cmd'),
    path = require('path'),
    node_ssh = require('node-ssh'),
    ssh = new node_ssh(),
    fs = require('fs');

function main() {
    console.log("Starting deployment script.");
    sshConnect();
}

// installs PM2
function installPM2() {
    return ssh.execCommand(
        'sudo npm install pm2 -g', {
        cwd: '/home/ubuntu'
    });
}

function transferProjectToRemote(failed, successful) {
    return ssh.putDirectory(
        '../starter-node-angular',
        '/home/ubuntu/starter-node-angular-temp',
        {
            recursive: true,
            concurrency: 1,
            validate: function(itemPath) {
                const baseName = path.basename(itemPath);
                return (
                    baseName.substr(0, 1) !== '.' && baseName !== 'node_modules' // do not allow dot files
                );
            },
            tick: function(localPath, remotePath, error) {
                if (error) {
                    failed.push(localPath);
                    console.log('failed.push: ' + localPath);
                } else {
                    successful.push(localPath);
                    console.log('successful.push: ' + localPath);
                }
            }
        }
    );
}

function createRemoteTempFolder() {
    return ssh.execCommand(
        'rm -rf starter-node-angular-temp && mkdir starter-node-angular-temp', {
        cwd: '/home/ubuntu'
    });
}

function stopRemoteServices() {
    return ssh.execCommand(
        'pm2 stop all', {
        cwd: '/home/ubuntu'
    });
}

function updateRemoteApp() {
    return ssh.execCommand(
        'cp -r starter-node-angular-temp/* starter-node-angular/ && rm -rf starter-node-angular-temp', {
        cwd: '/home/ubuntu'
    });
}

function restartRemoteServices() {
    return ssh.execCommand(
        'cd starter-node-angular && pm2 start app.js', {
        cwd: '/home/ubuntu'
    });
}

function sshConnect() {
    console.log("Connecting to server.");

    ssh.connect({
        host: '',
        username: 'ubuntu',
        privateKey: 'ang-key.pem'
    }).then(function() {
        console.log("SSH Connection to server successfully established.");
        console.log("Installing PM2");
        return installPM2();
    }).then(function() {
        console.log("Creating temporary file.");
        return createTempFile();
    }).then(function(result) {
        const failed = [],
              success = [];

        if(result.stdout) {
            console.log("STDOUT: " + result.stderr);
            return Promise.reject(result.stderr);
        }

        if(result.stderr) {
            console.log("STDERR: " + result.stderr);
        }

        console.log("Transferring files to server.");
        return transferFilesToServer();
    }).then(function(status) {
        if (status) {
            console.log('Updating remote app.');
            return updateRemoteApp();
        }

        else {
            return Promise.reject(failed.join(', '));
        }
    }).then(function(status) {
        if (status) {
            console.log('Restarting remote services...');
            return restartRemoteServices();
        }
        
        else {
            return Promise.reject(failed.join(', '));
        }
    })
    .then(function() {
        console.log('DEPLOYMENT COMPLETE!');
        process.exit(0);
    })
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
}