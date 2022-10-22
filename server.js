const host = "192.168.1.9";
// const host = "localhost";
const port = "5000";


const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const webrtc = require("wrtc");
const { MediaStream } = require('wrtc');
const { v4: uuidv4 } = require('uuid');
const sdpTransform = require('sdp-transform');

class Broadcaster {
    constructor(_id = null, _stream = new MediaStream(), _peer = new webrtc.RTCPeerConnection(),
        _consumers = []
    ) {
        this.id = _id
        this.stream = _stream
        this.peer = _peer
        this.consumers = _consumers
    }
}

class Consumer {
    constructor(_id = null, _peer = new webrtc.RTCPeerConnection()) {
        this.id = _id
        this.peer = _peer
    }
}


const broadcasters = [];

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ------------------------------------------------------------------------------------------------- broadcasters
app.post('/broadcast', async({ body }, res) => {
    var id = uuidv4()
        // broadcast.peer.ontrack = (e) => handleTrackEvent(e, broadcast);
        //    broadcast.peer.ontrack = (e) => broadcast.stream = e.streams[0];
        //     const desc = new webrtc.RTCSessionDescription(body.sdp);
        //     await broadcast.peer.setRemoteDescription(desc);
        //     const answer = await broadcast.peer.createAnswer();
        //     await broadcast.peer.setLocalDescription(answer);
        //     const payload = {
        //         sdp: broadcast.peer.localDescription
        //     }
        //     broadcasters.push(broadcast);
    await addBroadcast(id)
        // let i = await broadcasters.findIndex((e) => e.id == body.id)
    let i = await broadcastIndex(id)
    if (i >= 0) {
        broadcasters[i].peer.ontrack = (e) => broadcasters[i].stream = e.streams[0];

        broadcasters[i].peer.onIceCandidate = (e) => {
            if (e.candidate != null) {
                console.log("----onIceCandidate")
                console.log(JSON.stringify({
                    'candidate': e.candidate.toString(),
                    'sdpMid': e.sdpMid.toString(),
                    'sdpMlineIndex': e.sdpMlineIndex,
                }))
                console.log("----onIceCandidate")
            }
        }
        broadcasters[i].peer.onIceConnectionState = (e) => {
            console.log("----onIceConnectionState")
            console.log(e)
            console.log("----onIceConnectionState")
        }


        await broadcastOnnegotiationneeded(i, body.sdp)
        const payload = {
            sdp: broadcasters[i].peer.localDescription,
            id: id
        }
        res.json(payload);
    }
});

async function addBroadcast(id) {
    console.log("new broadcast");

    var broadcast = new Broadcaster(
        id,
        new MediaStream(),
        new webrtc.RTCPeerConnection({
            iceServers: [{
                urls: "stun:stun.stunprotocol.org"
                    // urls: "stun:stun.l.google.com:19302?transport=tcp"
            }]
        }, {
            "mandatory": {
                "OfferToReceiveAudio": true,
                "OfferToReceiveVideo": true,
            },
            "optional": [],
        })
    );



    await broadcasters.push(broadcast);
}

async function broadcastOnnegotiationneeded(i, sdp) {
    const desc = new webrtc.RTCSessionDescription(sdp);
    await broadcasters[i].peer.setRemoteDescription(desc);
    const answer = await broadcasters[i].peer.createAnswer({ 'offerToReceiveVideo': 1 });
    await broadcasters[i].peer.setLocalDescription(answer);
    console.log(broadcasters[i].peer.localDescription.type)
        // const session = sdpTransform.parse(String(broadcasters[i].peer.localDescription.sdp))
    const session = sdpTransform.parse(String(answer.sdp))
    console.log(session)
}


async function broadcastIndex(id) {
    let x = -1;
    for (let i = 0; i < broadcasters.length; i++) {
        if (broadcasters[i].id == id) {
            x = i;
            break;
        }
    }
    return x;
}

// function handleTrackEvent(e, broadcast) {
//     try {
//         broadcast.stream = e.streams[0];
//     } catch (e) {

//     }
// };

var consumers = [];
// ------------------------------------------------------------------------------------------------- consumer
app.post("/consumer", async({ body }, res) => {
    console.log("consumer");

    try {

        let i = await broadcastIndex(body.id)
        let x
        if (i >= 0) {
            x = await addConsumer(i)
        }
        if (x >= 0 && i >= 0) {

            await consumerOnnegotiationneeded(i, x, body.sdp)
            const payload = {
                sdp: broadcasters[i].consumers[x].peer.localDescription
            }

            res.json(payload);
        } else {
            console.log("not exist")
        }
    } catch (e) {
        console.log(e)
    }

});

async function consumerOnnegotiationneeded(i, x, sdp) {
    var desc = new webrtc.RTCSessionDescription(sdp);
    await broadcasters[i].consumers[x].peer.setRemoteDescription(desc);
    broadcasters[i].stream.getTracks().forEach(track => broadcasters[i].consumers[x].peer.addTrack(track, broadcasters[i].stream));
    const answer = await broadcasters[i].consumers[x].peer.createAnswer();
    await broadcasters[i].consumers[x].peer.setLocalDescription(answer);
    const session = sdpTransform.parse(String(answer.sdp))
    console.log(session)

}

async function addConsumer(indexBroadcast) {
    var id = uuidv4()
    var consumer = new Consumer(id, new webrtc.RTCPeerConnection({
        iceServers: [{
            urls: "stun:stun.stunprotocol.org"
                // urls: "stun:stun.l.google.com:19302?transport=tcp"
        }]
    }, {
        "mandatory": {
            "OfferToReceiveAudio": true,
            "OfferToReceiveVideo": true,
        },
        "optional": [],
    }))

    if (consumer.peer != undefined || consumer.peer != "undefined" || consumer.peer != null) {
        await broadcasters[indexBroadcast].consumers.push(consumer);
        return await consumerIndex(indexBroadcast, id)
    }
    return -1;
}

async function consumerIndex(indexBroadcast, id) {
    let x = -1;
    for (let i = 0; i < broadcasters[indexBroadcast].consumers.length; i++) {
        if (broadcasters[indexBroadcast].consumers[i].id == id) {
            x = i;
            break;
        }
    }
    return x;
}

// -------------------------------------------------------------------------------------------------
app.get("/list", (req, res) => {
    const data = listBroadCast();
    res.json(data);
})



function listBroadCast() {
    var data = [];
    for (i in broadcasters) {
        data.push(broadcasters[i].id)
    }
    return data;
}

// -------------------------------------------------------------------------------------------------
app.listen(port,
    host,
    () => console.log('server started: ' + host + ":" + port));