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

const { createApp, watchEffect } = Vue

mainApp = createApp({
    data() {
        return {
            letterDay: 'A',
            qrScanner: null,
            copyLinkText: "Copy Link",
            user: new User(JSON.parse(localStorage.getItem('user'))),
            cameraId: null,

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
        //Html5Qrcode.getCameras().then(devices => {
        //   if (devices && devices.length) {
        //       var cameraId = devices[0].id;
        this.qrScanner = new Html5Qrcode("qrScanner");
        //       this.cameraId = cameraId;
        //   }
        //}).catch(err => { });
        //this.qrScanner = new QrScanner(
        //    document.getElementById('qrScanner'),
        //    result => console.log(result),
        //    { returnDetailedScanResult: true },
        //);
        modal = document.querySelector('#addFriendModal')
        modal.addEventListener('shown.bs.modal', () => {
            this.qrScanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText, decodedResult) => {$('#addFriendModal').modal('hide');vm.user.addFriend(decodedText); },
                //(decodedText, decodedResult) => {
                //    console.log("test123")
                //    console.log(`Code scanned = ${decodedText}`, decodedResult);
                //    console.log("Scanned code: " + result);
                //    if (!result.startsWith(window.location.href + "?share=true")) {
                //        alert("Scanned QR code is not a valid Lunch Wave schedule!");
                //        return;
                //    }
                //    this.qrScanner.stop();
                //    $('#addFriendModal').modal('hide');
                //    this.user.addFriend(result);
                //},
                (errorMessage) => { })
                .catch((err) => { });
            //this.qrScanner.render(this.scanCode);
            //this.qrScanner.start();
        });
        modal.addEventListener('hidden.bs.modal', () => {
            this.qrScanner.stop();
        });
        new QRCode(document.getElementById("qrcode"), {
            width: 200,
            height: 200
        }).makeCode(this.user.share());
    },
    scanCode(result, decodedResult) {
        console.log("Scanned code: " + result);
        if (!result.startsWith(window.location.href + "?share=true")) {
            alert("Scanned QR code is not a valid Lunch Wave schedule!");
            return;
        }
        $('#addFriendModal').modal('hide');
        this.user.addFriend(result);

    }

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

            dayLabel(day) {
                const days = "ABCDEFGH";
                return days[day] ? `Day ${days[day]}` : "";
            },

            setWave(wave) {
                this.user.schedule["ABCDEFGH"[this.onboardDay]] = wave;
            },

            getWavePreview(day) {
                const d = "ABCDEFGH"[day];
                return d ? `Wave ${this.user.schedule[d] ?? "—"}` : "";
            }
        }
    }).mount('#onboarding')
}