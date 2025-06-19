document.addEventListener('DOMContentLoaded', () => {
    // Smooth scrolling for navigation links
    document.querySelectorAll('nav a').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });

            // Optional: Add active class to navigation link
            document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Intersection Observer for header active state
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('nav a');

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.7 // Highlight when 70% of the section is visible
    };

    const sectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const currentSectionId = entry.target.id;
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${currentSectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        sectionObserver.observe(section);
    });


    // Copy to clipboard functionality for contract address
    const copyButton = document.querySelector('.copy-btn');
    if (copyButton) {
        copyButton.addEventListener('click', async () => {
            const contractAddressElement = document.getElementById('contractAddress');
            if (contractAddressElement) {
                try {
                    await navigator.clipboard.writeText(contractAddressElement.textContent);
                    copyButton.textContent = 'Copied!'; // Changed to English
                    setTimeout(() => {
                        copyButton.textContent = 'Copy'; // Changed to English
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy text:', err);
                    alert('Failed to copy address. Please copy it manually: ' + contractAddressElement.textContent);
                }
            }
        });
    }
});
