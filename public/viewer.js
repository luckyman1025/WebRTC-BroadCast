const host = "http://192.168.1.9"
const port = 5000


const configurationPeerConnection = {
    iceServers: [{
        urls: "stun:stun.stunprotocol.org"
            // urls: "stun:stun.l.google.com:19302?transport=tcp"
    }]
}
const offerSdpConstraints = {
    "mandatory": {
        "OfferToReceiveAudio": true,
        "OfferToReceiveVideo": true,
    },
    "optional": [],
}

// "video", { direction: "recvonly" } | recvonly-> recieve only
// "video", { direction: "sendrecv" } | sendrecv-> send only
// {send: bool, receive: bool}
//{ direction: "sendrecv" }
// { direction: "recvonly" }
const addTransceiverConstraints = { direction: "recvonly" }

window.onload = () => {
    showList();
}

class TargetPeer {
    constructor(_broadcast_id = null, _consumer_id = null) {
        this.broadcast_id = _broadcast_id
        this.consumer_id = _consumer_id
    }
}
var targetPeer = new TargetPeer();


var peer
async function init(id) {
    console.log("start");
    peer = await createPeer(id);


}

async function createPeer(id) {
    peer = new RTCPeerConnection(configurationPeerConnection, offerSdpConstraints);

    peer.addTransceiver("video", addTransceiverConstraints)
    peer.addTransceiver("audio", addTransceiverConstraints)
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = async() => await handleNegotiationNeededEvent(peer, id);


    return peer;
}

async function handleNegotiationNeededEvent(peer, id) {
    const offer = await peer.createOffer({ 'offerToReceiveVideo': 1 });
    await peer.setLocalDescription(offer);
    const payload = {
        sdp: peer.localDescription,
        id: id,
        socket_id: socket_id
    };
    const { data } = await axios.post('/consumer', payload);
    targetPeer = new TargetPeer(
        data.targetPeer.broadcast_id,
        data.targetPeer.consumer_id
    );
    console.log("targetPeer");
    console.log(targetPeer);
    const desc = new RTCSessionDescription(data.sdp);
    await peer.setRemoteDescription(desc).catch(e => console.log(e));
    peer.onconnectionstatechange = (e) => {
        console.log("status")
        console.log(e)
    }
    peer.onicecandidateerror = (e) => {

        console.log("error1")
        console.log(e)
    }
    peer.oniceconnectionstatechange = (e) => {
        try {
            const connectionStatus = peer.connectionState;
            if (["disconnected", "failed", "closed"].includes(connectionStatus)) {
                console.log("disconnected")
            } else {
                console.log("still connected")
            }
        } catch (e) {
            console.log(e)
        }
    }

    peer.onicecandidate = (e) => {
        if (!e || !e.candidate) return;
        // console.log(e)
        var newCandidate = {
            'candidate': String(e.candidate.candidate),
            'sdpMid': String(e.candidate.sdpMid),
            'sdpMLineIndex': e.candidate.sdpMLineIndex,
        }
        console.log("ice candidate")
        console.log(newCandidate)
        addCandidate(newCandidate)
        console.log("ice candidate2")
        peer.addIceCandidate(new RTCIceCandidate(newCandidate))
    }
}

function handleTrackEvent(e) {
    console.log(e.streams[0])
    document.getElementById("video").srcObject = e.streams[0];
};

// -----------------------------------------------------------------------------
function watch(e) {
    var id = e.getAttribute("data");
    init(id)
    document.getElementById("text-container").innerHTML = "Streaming on id:" + id
}
// -----------------------------------------------------------------------------
async function showList() {
    const data = await axios.get("/list");
    var html = `<ul style="list-style-type: none;">`;
    data.data.forEach((e) => {
        console.log(e);
        html += `<li style="margin-top:4px;">
        <button data='` + e + `' id='view-` + e + `'
        onClick="watch(this)"
        >Watch ` + e + `</button>
        </li>`
    });
    html += "</ul>"
    document.getElementById('list-container').innerHTML += html
}
// -----------------------------------------------------------------------------

var socket = io(host + ":" + port);
var socket_id

socket.on('from-server', function(_socket_id) {
    socket_id = _socket_id
    console.log("me connected: " + socket_id)
});
socket.on("add-candidate-from-server", (message) => {
    console.log("******add candidate from server")
    console.log(message)
    peer.addIceCandidate(new RTCIceCandidate(message))
    console.log("@@@@@@add candidate from server")
})

function addCandidate(candidate) {
    socket.emit('add-candidate-consumer', {
        candidate: candidate,
        targetPeer: targetPeer
    });
}