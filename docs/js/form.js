//=========ADD AUDIO ============
document.getElementById("addAudio").addEventListener('click', function(){
    
    //create <div id="form_horizontal">
    var newDivHorizontal= document.createElement('div');
    newDivHorizontal.id='form_horizontal';
    newDivHorizontal.className='form_horizontal';
    

    //=======AUDIO FILE  
    //<div id="form_verticle">
    var divAudioFile= document.createElement('div');
    divAudioFile.id='form_verticle';

    //create <label>Audio file name</label>
    var labelAudioFile = document.createElement('label');
    labelAudioFile.innerHTML = "Audio file name";

    //create <input type="text" placeholder="Enter audio file name">
    var inputAudioFile= document.createElement('input');
    inputAudioFile.type="text";
    inputAudioFile.placeholder="Enter audio file name";

    //=======AUDIO NAME  
    //<div id="form_verticle">
    var divAudioName= document.createElement('div');
    divAudioName.id='form_verticle';

    //create <label>Audio file name</label>
    var labelAudioName = document.createElement('label');
    labelAudioName.innerHTML = "Audio Name";

    //create <input type="text" placeholder="Enter audio file name">
    var inputAudioName= document.createElement('input');
    inputAudioName.type="text";
    inputAudioName.placeholder="Enter audio name";

    //====DELETE AUDIO BUTTON
    var deletAudioButton =document.createElement('button');
    deletAudioButton.id='removeAudio';
    deletAudioButton.innerHTML="- Remove Audio";
    deletAudioButton.type="button";


    //append the Label and input to form_verticle div
    divAudioFile.appendChild(labelAudioFile);
    divAudioFile.appendChild(inputAudioFile);  

    divAudioName.appendChild(labelAudioName);
    divAudioName.appendChild(inputAudioName); 

    //append form_verticle to form_horizontal
    newDivHorizontal.appendChild(divAudioFile);
    newDivHorizontal.appendChild(divAudioName);
    newDivHorizontal.appendChild(deletAudioButton);

    //Appends form_horizontal to audio_section
    document.getElementById('audio_section').appendChild(newDivHorizontal);
});

//=====DELETE AUDIO =======
document.getElementById("removeAudio").addEventListener('click',function(event){
    console.log("hi");
    // var audio = button.closest('.form_verticle');
    // var audio = button.parentElement;
    
    var audio = event.target.closest('.form_horizontal');
     console.log(event.target);

    if(audio){
       audio.remove(); 
    }
    
});


//==============ADD GROUP CARD FUNCTION==========
document.getElementById("groupSelection").addEventListener('change', function(){
    //get number of groups selected
    var e = document.getElementById("groupSelection");
    
    var value = e.options[e.selectedIndex].value;
    console.log(value);

    //remove all previous cards
    var removeCards = document.querySelectorAll("#singleGroupe");
    //for each card remove it
    // removeCards is an array, we itterate with forEach, cards is the current card in the array and .remove() is a method to remove the card from the DOM
    removeCards.forEach(function(card) {
        card.remove();
    });
    

    //Add cards
    for (let index = 1; index <= value; index++) {
        //create a single card
        var divSectionGroupe= document.createElement('div');
        divSectionGroupe.id="singleGroupe";

        //Name the card
        var titleGroupeNb = document.createElement('h4');
        titleGroupeNb.innerHTML="Groupe "+index;

        //create label
        var nbOfPhonesLabel= document.createElement('label');
        nbOfPhonesLabel.innerHTML="Select a number of phones you want in this group?"

        //create field input
        var nbOfPhoneInput= document.createElement('input');
        nbOfPhoneInput.type="text";
        nbOfPhoneInput.placeholder="1";

        //put label and input inside single card
        divSectionGroupe.appendChild(titleGroupeNb);
        divSectionGroupe.appendChild(nbOfPhonesLabel);
        divSectionGroupe.appendChild(nbOfPhoneInput);

        //append card in groupeSection
        document.getElementById("groupeSection").appendChild(divSectionGroupe);
        
    }

});

