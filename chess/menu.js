const bots = [
    {
        id: "minimax",
        name: "Minimax",
        elo: 1850,
        description: "A strong search-based opponent.",
        difficulty: 4
    },

    {
        id: "greedy",
        name: "Greedy",
        elo: 900,
        description: "Loves capturing pieces.",
        difficulty: 2
    },

    {
        id: "random",
        name: "Random",
        elo: 400,
        description: "Makes completely unpredictable moves.",
        difficulty: 1
    }
];


let selectedBot = "minimax";

const modeButtons = document.querySelectorAll(".game-modes button");

modeButtons.forEach(button => {
    button.addEventListener("click", () => {

        modeButtons.forEach(button => {
            button.classList.remove("selected");
        });

        button.classList.add("selected");

        selectedStyle = button.dataset.style;
    });
});


const botList = document.getElementById("bot-list");


bots.forEach(bot => {
    const card = document.createElement("button");

    card.classList.add("bot-card");

    if (bot.id === selectedBot) {
        card.classList.add("selected");
    }

    card.innerHTML = `
        <div class="bot-icon">♟</div>

        <div class="bot-info">
            <div class="bot-name">${bot.name}</div>

            <div class="bot-description">
                ${bot.description}
            </div>

            <div class="bot-difficulty">
                Difficulty:
                ${"★".repeat(bot.difficulty)}
                ${"☆".repeat(5 - bot.difficulty)}
            </div>
        </div>

        <div class="bot-elo">
            ${bot.elo}
            <span>ELO</span>
        </div>
    `;

    botList.appendChild(card);


    card.addEventListener("click", () => {
        document.querySelectorAll(".bot-card").forEach(card => {
            card.classList.remove("selected");
        });

        card.classList.add("selected");

        selectedBot = bot.id;
    });
});

const startButton = document.getElementById("start-game");

startButton.addEventListener("click", () => {
    const params = new URLSearchParams();

    params.set("style", selectedStyle);

    if (selectedStyle !== "twoplayer") {
        params.set("botName", selectedBot);
    }

    window.location.href = `game?${params.toString()}`;
});
