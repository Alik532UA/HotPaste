<div class="mesh-bg"></div>

<style>
    .mesh-bg {
        position: fixed;
        inset: 0;
        z-index: -1;
        background-color: var(--color-bg-primary);
        background-image: 
            radial-gradient(at 0% 0%, hsla(190, 100%, 50%, 0.05) 0px, transparent 50%),
            radial-gradient(at 100% 0%, hsla(250, 100%, 65%, 0.05) 0px, transparent 50%),
            radial-gradient(at 100% 100%, hsla(190, 100%, 50%, 0.05) 0px, transparent 50%),
            radial-gradient(at 0% 100%, hsla(250, 100%, 65%, 0.05) 0px, transparent 50%);
        filter: blur(100px);
        animation: meshMove 20s ease infinite alternate;
    }

    @keyframes meshMove {
        0% { transform: scale(1); }
        100% { transform: scale(1.2); }
    }
</style>
