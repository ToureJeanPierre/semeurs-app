import Image from "next/image";

/**
 * Écran de lancement « comme Yango » (demande de Jean-Pierre du 27/10/2026) :
 * fond bleu roi, le logo apparaît, un balayage de lumière le traverse, puis
 * l'écran glisse vers le haut et laisse place à l'appli.
 *
 * Entièrement en CSS (aucun JavaScript à attendre) et rendu dès le HTML : il
 * s'affiche instantanément, même en 3G. Une seule fois par ouverture de l'appli :
 * le petit script ci-dessous le masque avant affichage s'il a déjà été vu.
 */
export function SplashScreen() {
  return (
    <>
      <script
        // Avant le premier affichage : déjà vu pendant cette ouverture → pas de lancement.
        dangerouslySetInnerHTML={{
          __html:
            "try{if(sessionStorage.getItem('semeurs:splash'))document.documentElement.classList.add('splash-seen');else sessionStorage.setItem('semeurs:splash','1')}catch(e){}",
        }}
      />
      <div id="splash" aria-hidden className="splash">
        <div className="splash-logo">
          <Image src="/logo-semeurs.webp" alt="" width={148} height={148} priority />
          <span className="splash-sweep" />
        </div>
        <p className="splash-name">Les Semeurs de la Parole</p>
      </div>
    </>
  );
}
