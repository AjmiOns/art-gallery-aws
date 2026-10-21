// Aperçu visuel de la carte bancaire pendant la saisie
export default function CardPreview({ number, holder, expiry }: { number: string; holder: string; expiry: string }) {
  const digits = number.replace(/\s/g, '');
  const brand = /^4/.test(digits) ? 'VISA' : /^(5[1-5]|2[2-7])/.test(digits) ? 'Mastercard' : /^3[47]/.test(digits) ? 'AMEX' : '';
  const shown = (digits + '################').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  return (
    <div className="card-preview" aria-hidden="true">
      <div className="card-preview__top">
        <span className="card-preview__chip" />
        <span className="card-preview__brand">{brand}</span>
      </div>
      <div className="card-preview__number">{shown}</div>
      <div className="card-preview__bottom">
        <div><small>Titulaire</small><span>{holder || 'NOM PRÉNOM'}</span></div>
        <div><small>Expire</small><span>{expiry || 'MM/AA'}</span></div>
      </div>
    </div>
  );
}
