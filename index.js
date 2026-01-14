const { createApp, watchEffect } = Vue
document.getElementById("versionText").innerText = "0.6";
//classes
class Friend {
    constructor(data) {
        this.name = data.name;
        this.schedule = data.schedule;
    }
    wave(day) {
        return this.schedule[day];
    }

}
class User extends Friend {
    constructor(data) {
        super(data);
        this.friends = data.friends.map(friend => new Friend(friend));

    }
    addFriend(friend) {
        friend = new URL(friend).searchParams.get("friend");
        this.friends.push(new Friend(JSON.parse(friend)));
    }
    removeFriend(index) {
        this.friends.splice(index, 1);
    }
    share() {
        const { friends, ...shared } = this;
        return window.location.href + "?share=true&friend=" + JSON.stringify(shared);
        //return "";
    }
}

var mainApp = createApp({
    data() {
        return {
            letterDay: 'A',
            qrScannerStream: null,
            copyLinkText: "Copy Link",
            user: new User(JSON.parse(localStorage.getItem('user'))),
            intervalID: null

        }
    },
    methods: {
        copyLink() {
            navigator.clipboard.writeText(this.user.share())
            this.copyLinkText = "Copied!"
            setTimeout(() => {
                this.copyLinkText = "Copy Link"
            }, 2000)
        },
        deleteData() {
            if (this.$refs.deleteDataButton.confirmed) {
                localStorage.removeItem('user');
                localStorage.removeItem('onboarded');
                window.location.reload();
            } else {
                this.$refs.deleteDataButton.innerText = "Are you sure?";
                this.$refs.deleteDataButton.confirmed = true;
            }
        },
        scanCode(result) { },
        isMobile() {
            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                return true
            } else {
                return false
            }
        },
        addFriendFromLink() {
            this.user.addFriend(document.getElementById("friendLinkInput").value);
        }
    },
    created() {
        watchEffect(() => {
            localStorage.setItem('user', JSON.stringify(this.user));
        });
        //handle shared schedule in URL
        if (window.location.search.includes("share=true")) {
            console.log("Adding friend from shared URL");
            this.user.addFriend(window.location.href);
            window.location.search = "";
        }
        fetch("/days.csv").then(response => response.text()).then(data => {
            let lines = data.split("\n");
            lines.forEach(line => {
                if (line.split(",")[0] == new Date().toISOString().split('T')[0]) {
                    this.letterDay = line.split(",")[1];

                }
            });
        });
    },
    mounted() {
        var vm = this;
        var modal = document.querySelector('#addFriendModal')
        if (!this.isMobile()) {
            modal.addEventListener('shown.bs.modal', async () => {
                const video = document.getElementById("qrScanner2");
                this.qrScannerStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" }
                });
                video.srcObject = this.qrScannerStream;
                await video.play();

                const detector = new BarcodeDetector({ formats: ["qr_code"] });
                async function scanLoop() {
                    console.log("Scanning...");
                    const codes = await detector.detect(video);
                    if (codes.length) {
                        var result = codes[0].rawValue;
                        console.log("INSTANT scan:", codes[0].rawValue);
                        if (!result.startsWith(window.location.href + "?share=true")) {
                            alert("Scanned QR code is not a valid LunchByte schedule!");
                            return;
                        }
                        $('#addFriendModal').modal('hide');
                        vm.user.addFriend(result);
                        return;
                    }
                }
                this.intervalID = setInterval(scanLoop, 500);
            });
            modal.addEventListener('hidden.bs.modal', () => {
                if (this.qrScannerStream) {
                    this.qrScannerStream.getTracks().forEach(track => track.stop());
                }
                clearInterval(this.intervalID);
            });
        }
        new QRCode(document.getElementById("qrcode"), {
            width: 200,
            height: 200
        }).makeCode(this.user.share());
    },

})
if (window.localStorage.getItem('onboarded') == 'true') {
    document.getElementById("onboarding").remove();
    mainApp.mount('#app')
} else {
    document.getElementById("app").remove();
    createApp({
        data() {
            return {
                onboardDay: 0,
                user: new User({ name: '', schedule: { 'A': 1, 'B': 1, 'C': 1, 'D': 1, 'E': 1, 'F': 1, 'G': 1, 'H': 1 }, friends: [] })
            }
        },
        methods: {
            nextDay() {
                if (this.onboardDay == 7) {
                    this.onboardDay = -1;
                } else if (this.onboardDay == -1) {
                    window.localStorage.setItem('user', JSON.stringify(this.user));
                    window.localStorage.setItem('onboarded', 'true');
                    window.location.reload();
                } else {
                    this.onboardDay++;
                }
            },
            cardClass(day) {
                if (day === this.onboardDay) return "center";
                if (day < 0 || day > 7) return "side hidden";
                return "side";
            },
            isValidDay(day) {
                return day >= 0 && day <= 7
            }
        }
    }).mount('#onboarding')
}