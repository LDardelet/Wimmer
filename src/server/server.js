const ws = require('ws');
const net = require('net');

const command_port = 3000;
const control_port = 6001;
const host = '127.0.0.1';

let control_sockets = [];

let state = {
    command_clients: 0, // Web Browsers connected
    control_clients: 0, // ESP32 connected
    control_total_clients: 0,
    control_enabled: [],
    control_values: [],
    control_names: []
}
state.addControlClient = function(socket) {
    state.control_clients ++;
    state.control_total_clients ++;
    control_sockets.push(socket);
    state.control_enabled.push(true);
    state.control_values.push(0);
    state.control_names.push("DefaultName_" + String(state.control_total_clients));
}
state.removeControlClient = function(index) {
    state.control_clients --;
    control_sockets.splice(index, 1);
    state.control_enabled.splice(index, 1);
    state.control_values.splice(index, 1);
    state.control_names.splice(index, 1);
}
// Command server, for browser clients

const commands_server = new ws.Server({port: command_port});
commands_server.broadcast = data => {
    console.log(data);
    
    const data_as_string = JSON.stringify(data);
    for (const client of commands_server.clients) {
        if (client.readyState === ws.OPEN) {
            client.send(data_as_string);
        }
    }
};
commands_server.on('connection', socket => {
    console.log("New connexion");
    state.command_clients = commands_server.clients.size;
    console.log(commands_server.clients.size);
    console.log(JSON.stringify(state));
    socket.on('message', async message => {
        state = JSON.parse(message).state;
        console.log("Received new state : " + JSON.stringify(state));
            
        commands_server.broadcast({state: state});
        //await write(state_to_buffer(state));
        //commands_socket.send(JSON.stringify({error: null}));
    });
    //socket.send(JSON.stringify({state: state}));
    commands_server.broadcast({state: state});
});
console.log('Command ws server listening on port ' + command_port);

// Control server, for ESP32 connections

const control_server = net.createServer();
control_server.listen(control_port, host, () => {
    console.log('Control TCP Server is running on port ' + control_port + '.');
});

control_server.on('connection', function(socket) {

    console.log("Incomming connection from " + socket.remoteAddress + ":" + socket.remotePort);
    state.addControlClient(socket);
    commands_server.broadcast({state: state});

    socket.on('data', function(data) {
        console.log("Incomming data from " + socket.remoteAddress + ": " + data);
    });

    socket.on('close', function(data) {
        let index = control_sockets.findIndex(function(o) {
            return o.remoteAddress === socket.remoteAddress && o.remotePort === socket.remotePort;
        })
        if (index !== -1) state.removeControlClient(index);
        console.log('CLOSED: ' + socket.remoteAddress + ' ' + socket.remotePort);
        console.log("Index was " + index);
        commands_server.broadcast({state: state});
    });
});


